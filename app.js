// ELEMENTOS
const miNumeroInput = document.getElementById('miNumero');
const btnConectar = document.getElementById('btnConectar');
const estadoConexion = document.getElementById('estadoConexion');
const itemsMenu = document.querySelectorAll('.item-menu');
const vistas = document.querySelectorAll('.vista-pestana');
const numeroDestinoInput = document.getElementById('numeroDestino');
const btnAgregarUsuario = document.getElementById('btnAgregarUsuario');
const listaContactos = document.getElementById('listaContactos');
const listaChats = document.getElementById('listaChats');
const listaLlamadas = document.getElementById('listaLlamadas');
const sinChats = document.getElementById('sinChats');
const sinLlamadas = document.getElementById('sinLlamadas');
const contadorGlobalSinLeer = document.getElementById('contadorGlobalSinLeer');

const pantallaPrincipal = document.getElementById('pantallaPrincipal');
const pantallaChat = document.getElementById('pantallaChat');
const nombreChat = document.getElementById('nombreChat');
const cajaMensajes = document.getElementById('cajaMensajes');
const btnVolver = document.getElementById('btnVolver');
const btnLlamar = document.getElementById('btnLlamar');
const btnOpciones = document.getElementById('btnOpciones');
const menuOpciones = document.getElementById('menuOpciones');
const inputMensaje = document.getElementById('inputMensaje');
const btnEnviar = document.getElementById('btnEnviar');
const inputImagen = document.getElementById('inputImagen');
const inputVideo = document.getElementById('inputVideo');
const opcionesEnvio = document.querySelectorAll('.opcion-envio');

const pantallaLlamada = document.getElementById('pantallaLlamada');
const pantallaLlamadaEntrante = document.getElementById('pantallaLlamadaEntrante');
const estadoLlamada = document.getElementById('estadoLlamada');
const quienLlama = document.getElementById('quienLlama');
const btnColgar = document.getElementById('btnColgar');
const btnResponder = document.getElementById('btnResponder');
const btnRechazar = document.getElementById('btnRechazar');

const visorCompleto = document.getElementById('visorCompleto');
const contenidoVisor = document.getElementById('contenidoVisor');
const btnCerrarVisor = document.getElementById('btnCerrarVisor');

// ⭐ AVISOS EN PANTALLA
function mostrarAviso(texto, tipo='info') {
  const aviso = document.createElement('div');
  aviso.style.cssText = `
    position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
    padding: 10px 20px; border-radius: 20px; background: ${
      tipo==='exito'?'#25c557':tipo==='error'?'#ff4444':'#333'
    }; color: white; z-index: 9999; font-size: 14px;
  `;
  aviso.textContent = texto;
  document.body.appendChild(aviso);
  setTimeout(()=>aviso.remove(), 3000);
}

// ESTADO GLOBAL
let peer = null;
let miId = '';
let baseDatos = null;
let contactos = {};
let chatActivo = null;
let conexiones = {};
let mensajesSinLeer = {};
let reconectandoActivo = false;

// 💓 LATIDOS
const estadoAmigos = {};
const LATIDO_INTERVALO = 5000;

function enviarLatido(aDestino) {
  if (conexiones[aDestino]?.open) {
    try {
      conexiones[aDestino].send(JSON.stringify({ tipo: 'latido', desde: miId, tiempo: Date.now() }));
      estadoAmigos[aDestino] = { visto: Date.now(), ok: true };
    } catch(e) {
      estadoAmigos[aDestino] = { visto: Date.now(), ok: false };
    }
  }
}

function actualizarEstadoAmigo(numeroAmigo) {
  const estado = estadoAmigos[numeroAmigo];
  if (!estado) return 'desconocido';
  const msPasados = Date.now() - estado.visto;
  if (msPasados < 15000 && estado.ok) return 'conectado';
  return 'desconectado';
}

// 📂 INDEXEDDB
function iniciarDB() {
  return new Promise((res, rej) => {
    const solicitud = indexedDB.open('CodexDB_v3', 1);
    
    solicitud.onupgradeneeded = e => {
      baseDatos = e.target.result;
      if (!baseDatos.objectStoreNames.contains('perfil')) {
        baseDatos.createObjectStore('perfil');
      }
      if (!baseDatos.objectStoreNames.contains('mensajes')) {
        const store = baseDatos.createObjectStore('mensajes', { keyPath: 'id' });
        store.createIndex('conQuien', 'conQuien', { unique: false });
      }
    };
    
    solicitud.onsuccess = e => {
      baseDatos = e.target.result;
      res();
    };
    
    solicitud.onerror = e => {
      mostrarAviso('❌ No se pudo abrir la base de datos', 'error');
      rej(e.target.error);
    };
  });
}

async function guardarValor(clave, valor) {
  return new Promise((res, rej) => {
    const tx = baseDatos.transaction('perfil', 'readwrite');
    tx.objectStore('perfil').put(valor, clave);
    tx.oncomplete = () => res();
    tx.onerror = e => rej(e.target.error);
  });
}

async function leerValor(clave) {
  return new Promise((res, rej) => {
    const tx = baseDatos.transaction('perfil');
    const solicitud = tx.objectStore('perfil').get(clave);
    solicitud.onsuccess = () => res(solicitud.result || null);
    solicitud.onerror = e => rej(e.target.error);
  });
}

// ✅ GUARDAR MENSAJE — con aviso
async function guardarMensaje(conQuien, mensaje) {
  if (!conQuien) {
    mostrarAviso('❌ Error: sin destinatario', 'error');
    return;
  }

  const registro = {
    id: `${conQuien}-${Date.now()}`,
    conQuien: conQuien,
    de: mensaje.de,
    para: mensaje.para,
    tipo: mensaje.tipo,
    texto: mensaje.texto || '',
    datos: mensaje.datos || '',
    propio: !!mensaje.propio,
    fecha: mensaje.fecha || Date.now()
  };

  return new Promise((res, rej) => {
    const tx = baseDatos.transaction('mensajes', 'readwrite');
    tx.objectStore('mensajes').put(registro);
    tx.oncomplete = () => {
      mostrarAviso('✅ Mensaje guardado', 'exito');
      if (!contactos[conQuien]) {
        contactos[conQuien] = { mensajes: [], ultimoMensaje: '', ultimoTiempo: 0, leido: true };
      }
      contactos[conQuien].mensajes.push(registro);
      const preview = registro.tipo === 'imagen' ? '[Imagen]' :
                      registro.tipo === 'video' ? '[Video]' : registro.texto;
      contactos[conQuien].ultimoMensaje = preview;
      contactos[conQuien].ultimoTiempo = registro.fecha;
      res();
    };
    tx.onerror = e => {
      mostrarAviso('❌ No se pudo guardar', 'error');
      rej(e.target.error);
    };
  });
}

// ✅ CARGAR MENSAJES — con aviso
async function cargarTodosLosMensajes() {
  return new Promise((res, rej) => {
    if (!baseDatos) { mostrarAviso('❌ Base de datos no lista', 'error'); return res({}); }
    
    const tx = baseDatos.transaction('mensajes', 'readonly');
    const todos = tx.objectStore('mensajes').getAll();
    
    todos.onsuccess = () => {
      const todosMensajes = todos.result;
      
      if (todosMensajes.length === 0) {
        mostrarAviso('📂 No hay mensajes guardados aún');
        return res({});
      }
      
      const mapa = {};
      todosMensajes.forEach(msg => {
        if (!msg.conQuien) return;
        if (!mapa[msg.conQuien]) {
          mapa[msg.conQuien] = { mensajes: [], ultimoMensaje: '', ultimoTiempo: 0, leido: true };
        }
        mapa[msg.conQuien].mensajes.push(msg);
        const preview = msg.tipo === 'imagen' ? '[Imagen]' :
                        msg.tipo === 'video' ? '[Video]' : msg.texto;
        mapa[msg.conQuien].ultimoMensaje = preview;
        mapa[msg.conQuien].ultimoTiempo = msg.fecha;
      });
      
      mostrarAviso(`📂 Cargados ${todosMensajes.length} mensajes`, 'exito');
      res(mapa);
    };
    
    todos.onerror = e => {
      mostrarAviso('❌ No se pudieron cargar los mensajes', 'error');
      rej(e.target.error);
    };
  });
}

function actualizarContadorGlobal() {
  const total = Object.values(mensajesSinLeer).reduce((a, b) => a + b, 0);
  contadorGlobalSinLeer.style.display = total > 0 ? 'flex' : 'none';
  contadorGlobalSinLeer.textContent = total > 99 ? '99+' : total;
}

// 🔄 RECONEXIÓN
async function reconectar() {
  if (!miId || reconectandoActivo) return;
  
  reconectandoActivo = true;
  if (peer) peer.destroy();

  estadoConexion.textContent = 'Reconectando...';
  estadoConexion.className = 'estado-texto estado-reintentando';
  btnConectar.textContent = 'Conectando...';
  btnConectar.disabled = true;

  peer = new Peer(miId, { debug: 1 });

  peer.on('open', () => {
    estadoConexion.textContent = '● En línea';
    estadoConexion.className = 'estado-texto estado-conectado';
    btnConectar.textContent = 'Conectado';
    btnConectar.disabled = true;
    miNumeroInput.readOnly = true;
    reconectandoActivo = false;
  });

  peer.on('connection', manejarConexionEntrante);
  peer.on('call', manejarLlamadaEntrante);

  peer.on('close', () => {
    if (!reconectandoActivo) setTimeout(reconectar, 3000);
  });

  peer.on('error', err => {
    reconectandoActivo = false;
    if (err.type === 'unavailable-id') {
      estadoConexion.textContent = 'Número en uso';
      estadoConexion.className = 'estado-texto estado-desconectado';
      btnConectar.disabled = false;
      btnConectar.textContent = 'Conectar';
    } else {
      estadoConexion.textContent = 'Reconectando...';
      estadoConexion.className = 'estado-texto estado-reintentando';
      setTimeout(reconectar, 3000);
    }
  });
}

// 🚀 INICIO
async function iniciar() {
  await iniciarDB();
  
  const numeroGuardado = await leerValor('miNumero');
  if (numeroGuardado) {
    miNumeroInput.value = numeroGuardado;
    miId = numeroGuardado;
    setTimeout(reconectar, 500);
  }

  contactos = await cargarTodosLosMensajes();
  
  Object.keys(contactos).forEach(numero => {
    if (!contactos[numero].leido) mensajesSinLeer[numero] = 1;
  });
  actualizarContadorGlobal();
  
  renderizarListaChats();
  renderizarListaContactos();

  setInterval(() => {
    if (miId && peer && peer.open) {
      Object.keys(conexiones).forEach(amigo => enviarLatido(amigo));
    }
  }, LATIDO_INTERVALO);
}

async function conectar(numero) {
  if (!numero) return;
  miId = numero;
  await guardarValor('miNumero', numero);
  reconectar();
}

btnConectar.addEventListener('click', () => {
  const numero = miNumeroInput.value.trim();
  if (!numero) { alert('Escribe tu número primero'); return; }
  conectar(numero);
});

itemsMenu.forEach(item => {
  item.addEventListener('click', () => {
    const nombre = item.dataset.pestana;
    itemsMenu.forEach(i => i.classList.toggle('activa', i === item));
    vistas.forEach(v => v.classList.toggle('activa', v.id === `vista-${nombre}`));
    menuOpciones.classList.remove('mostrar');
  });
});

btnAgregarUsuario.addEventListener('click', () => {
  const numero = numeroDestinoInput.value.trim();
  if (!numero || numero === miId) { alert('Número inválido'); return; }
  if (!contactos[numero]) {
    contactos[numero] = { mensajes: [], ultimoMensaje: '', ultimoTiempo: 0, leido: true };
  }
  
  if (peer && peer.open) {
    const conn = peer.connect(numero);
    conn.on('open', () => {
      conexiones[numero] = conn;
      renderizarListaChats();
      renderizarListaContactos();
      abrirChat(numero);
    });
    conn.on('data', d => procesarMensajeRecibido(d, numero));
  } else {
    alert('Conéctate primero');
  }
  numeroDestinoInput.value = '';
});

function renderizarListaContactos() {
  listaContactos.innerHTML = '';
  if (Object.keys(contactos).length === 0) {
    listaContactos.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Aún no tienes contactos</p>';
    return;
  }
  Object.keys(contactos).forEach(numero => {
    const estado = actualizarEstadoAmigo(numero);
    const div = document.createElement('div');
    div.className = 'item-contacto';
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:12px;height:12px;border-radius:50%;background:${
          estado === 'conectado' ? '#25c557' : '#888'
        }"></div>
        <div>
          <div class="nombre-contacto">${numero}</div>
          <div class="info-mensaje">${estado === 'conectado' ? 'En línea' : 'Desconectado'}</div>
        </div>
      </div>
    `;
    div.addEventListener('click', () => abrirChat(numero));
    listaContactos.appendChild(div);
  });
}

function renderizarListaChats() {
  listaChats.innerHTML = '';
  const hayChats = Object.keys(contactos).length > 0;
  sinChats.classList.toggle('oculto', hayChats);
  
  if (!hayChats) return;
  
  const ordenados = Object.entries(contactos).sort((a, b) => (b[1].ultimoTiempo || 0) - (a[1].ultimoTiempo || 0));
  
  ordenados.forEach(([numero, datos]) => {
    const sinLeer = mensajesSinLeer[numero] && chatActivo !== numero;
    const estado = actualizarEstadoAmigo(numero);
    const div = document.createElement('div');
    div.className = 'item-chat';
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:12px;height:12px;border-radius:50%;background:${
          estado === 'conectado' ? '#25c557' : '#888'
        };flex-shrink:0;"></div>
        <div style="flex:1;">
          <div class="nombre-contacto">${numero}</div>
          <div class="info-mensaje">${datos.ultimoMensaje || 'Sin mensajes'}</div>
        </div>
        ${sinLeer ? '<div style="background:#25c557;color:#fff;border-radius:10px;padding:2px 8px;font-size:12px;">●</div>' : ''}
      </div>
    `;
    div.addEventListener('click', () => abrirChat(numero));
    listaChats.appendChild(div);
  });
}

function renderizarListaLlamadas() {
  listaLlamadas.innerHTML = '';
  sinLlamadas.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Historial disponible en versión completa</p>';
}

function abrirChat(numero) {
  chatActivo = numero;
  nombreChat.textContent = numero;
  cajaMensajes.innerHTML = '';
  mensajesSinLeer[numero] = 0;
  if (contactos[numero]) contactos[numero].leido = true;
  actualizarContadorGlobal();

  if (contactos[numero]?.mensajes) {
    contactos[numero].mensajes.forEach(m => renderizarMensaje(m));
  }

  if (peer && peer.open && !conexiones[numero]) {
    const conn = peer.connect(numero);
    conn.on('open', () => {
      conexiones[numero] = conn;
      enviarLatido(numero);
    });
    conn.on('data', d => procesarMensajeRecibido(d, numero));
  }

  pantallaPrincipal.classList.remove('activa');
  pantallaChat.classList.add('activa');
  document.body.classList.add('con-chat-abierto');
  menuOpciones.classList.remove('mostrar');
}

btnVolver.addEventListener('click', () => {
  pantallaChat.classList.remove('activa');
  pantallaPrincipal.classList.add('activa');
  document.body.classList.remove('con-chat-abierto');
  chatActivo = null;
  renderizarListaChats();
  renderizarListaContactos();
  menuOpciones.classList.remove('mostrar');
});

btnOpciones.addEventListener('click', () => {
  menuOpciones.classList.toggle('mostrar');
});

opcionesEnvio.forEach(boton => {
  boton.addEventListener('click', () => {
    const tipo = boton.dataset.tipo;
    menuOpciones.classList.remove('mostrar');
    if (tipo === 'imagen') inputImagen.click();
    else if (tipo === 'video') inputVideo.click();
  });
});

btnEnviar.addEventListener('click', enviarMensaje);
inputMensaje.addEventListener('keydown', e => {
  if (e.key === 'Enter' && inputMensaje.value.trim()) enviarMensaje();
});

async function enviarMensaje() {
  const texto = inputMensaje.value.trim();
  if (!texto || !chatActivo) return;

  const mensaje = {
    tipo: 'mensaje',
    texto: texto,
    de: miId,
    para: chatActivo,
    propio: true,
    fecha: Date.now()
  };

  if (conexiones[chatActivo]?.open) {
    conexiones[chatActivo].send(JSON.stringify(mensaje));
  }

  await guardarMensaje(chatActivo, mensaje);
  renderizarMensaje(mensaje);
  inputMensaje.value = '';
  renderizarListaChats();
}

inputImagen.addEventListener('change', async e => {
  const archivo = e.target.files[0];
  if (!archivo || !chatActivo) return;
  
  const lector = new FileReader();
  lector.onload = async function(evento) {
    const mensaje = {
      tipo: 'imagen',
      datos: evento.target.result,
      de: miId,
      para: chatActivo,
      propio: true,
      fecha: Date.now()
    };
    
    if (conexiones[chatActivo]?.open) {
      conexiones[chatActivo].send(JSON.stringify(mensaje));
    }
    
    await guardarMensaje(chatActivo, mensaje);
    renderizarMensaje(mensaje);
    renderizarListaChats();
  };
  lector.readAsDataURL(archivo);
  inputImagen.value = '';
});

inputVideo.addEventListener('change', async e => {
  const archivo = e.target.files[0];
  if (!archivo || !chatActivo) return;
  
  const lector = new FileReader();
  lector.onload = async function(evento) {
    const mensaje = {
      tipo: 'video',
      datos: evento.target.result,
      de: miId,
      para: chatActivo,
      propio: true,
      fecha: Date.now()
    };
    
    if (conexiones[chatActivo]?.open) {
      conexiones[chatActivo].send(JSON.stringify(mensaje));
    }
    
    await guardarMensaje(chatActivo, mensaje);
    renderizarMensaje(mensaje);
    renderizarListaChats();
  };
  lector.readAsDataURL(archivo);
  inputVideo.value = '';
});

function renderizarMensaje(m) {
  const div = document.createElement('div');
  div.className = `mensaje ${m.propio ? 'propio' : 'otro'}`;
  const hora = new Date(m.fecha).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  
  if (m.tipo === 'mensaje' || m.tipo === 'texto') {
    div.innerHTML = `<p>${m.texto || ''}</p><p class="hora">${hora}</p>`;
  } else if (m.tipo === 'imagen') {
    div.innerHTML = `<img src="${m.datos}" style="max-width:200px;border-radius:8px;"><p class="hora">${hora}</p>`;
  } else if (m.tipo === 'video') {
    div.innerHTML = `<video controls style="max-width:200px;border-radius:8px;"><source src="${m.datos}"></video><p class="hora">${hora}</p>`;
  }

  cajaMensajes.appendChild(div);
  cajaMensajes.scrollTop = cajaMensajes.scrollHeight;
}

function manejarConexionEntrante(conn) {
  const numero = conn.peer;
  conexiones[numero] = conn;
  estadoAmigos[numero] = { visto: Date.now(), ok: true };

  conn.on('data', datos => procesarMensajeRecibido(datos, numero));
  
  conn.on('close', () => {
    estadoAmigos[numero] = { visto: Date.now(), ok: false };
  });
  
  renderizarListaChats();
  renderizarListaContactos();
}

async function procesarMensajeRecibido(datosCrudos, deNumero) {
  let datos;
  try {
    datos = typeof datosCrudos === 'string' ? JSON.parse(datosCrudos) : datosCrudos;
  } catch {
    return;
  }

  if (datos.tipo === 'latido') {
    estadoAmigos[deNumero] = { visto: Date.now(), ok: true };
    return;
  }

  if (['mensaje', 'imagen', 'video', 'audio'].includes(datos.tipo)) {
    datos.propio = false;
    datos.fecha = datos.fecha || Date.now();
    
    await guardarMensaje(deNumero, datos);
    
    if (chatActivo === deNumero) {
      renderizarMensaje(datos);
    } else {
      mensajesSinLeer[deNumero] = (mensajesSinLeer[deNumero] || 0) + 1;
      actualizarContadorGlobal();
    }
    
    renderizarListaChats();
  }
}

btnLlamar.addEventListener('click', () => alert('Llamadas en construcción'));
btnColgar?.addEventListener('click', () => {});
btnResponder?.addEventListener('click', () => {});
btnRechazar?.addEventListener('click', () => {});

btnCerrarVisor.addEventListener('click', () => {
  visorCompleto.classList.add('oculto');
  contenidoVisor.innerHTML = '';
});

iniciar();
