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

// ESTADO GLOBAL
let peer = null;
let miId = '';
let baseDatos = null;
let contactos = {};
let chatActivo = null;
let conexiones = {};
let llamadaActiva = null;
let flujoLocal = null;
let reconectarTiempo = null;
let grabandoAudio = false;
let grabadoraActiva = null;
let flujoGrabacion = null;
let mensajesSinLeer = {};
let reconectandoActivo = false;

// 💓 SISTEMA DE LATIDO
const estadoAmigos = {};
const LATIDO_INTERVALO = 8000;

function enviarLatido(aDestino) {
  if (conexiones[aDestino]?.open) {
    try {
      conexiones[aDestino].send(JSON.stringify({
        tipo: 'latido',
        desde: miId,
        tiempo: Date.now()
      }));
      estadoAmigos[aDestino] = { visto: Date.now(), ok: true };
    } catch(e) {
      estadoAmigos[aDestino] = { visto: Date.now(), ok: false };
    }
  }
}

function actualizarEstadoAmigo(numeroAmigo) {
  const estado = estadoAmigos[numeroAmigo];
  if (!estado) return 'desconocido';
  
  const segundosPasados = (Date.now() - estado.visto) / 1000;
  if (segundosPasados < 15 && estado.ok) return 'conectado';
  if (segundosPasados < 45) return 'inactivo';
  return 'desconectado';
}

// 💾 GUARDADO DOBLE: IndexedDB + localStorage como respaldo
function guardarChatsEnLocal() {
  try {
    localStorage.setItem('codex_chats', JSON.stringify(contactos));
    console.log('📋 Respaldo guardado en localStorage');
  } catch (e) {
    console.warn('⚠️ No se pudo guardar en localStorage:', e);
  }
}

function cargarChatsDeLocal() {
  try {
    const datos = localStorage.getItem('codex_chats');
    if (datos) {
      console.log('📋 Cargando respaldo desde localStorage');
      return JSON.parse(datos);
    }
  } catch (e) {
    console.warn('⚠️ No se pudo leer de localStorage:', e);
  }
  return {};
}

// 📂 BASE DE DATOS LOCAL
function iniciarDB() {
  return new Promise((res, rej) => {
    const solicitud = indexedDB.open('CodexDB', 3);
    solicitud.onupgradeneeded = e => {
      baseDatos = e.target.result;
      if (!baseDatos.objectStoreNames.contains('perfil')) {
        baseDatos.createObjectStore('perfil');
      }
      if (!baseDatos.objectStoreNames.contains('chats')) {
        const store = baseDatos.createObjectStore('chats', { keyPath: 'id' });
        store.createIndex('conQuien', 'conQuien', { unique: false });
      }
    };
    solicitud.onsuccess = e => { baseDatos = e.target.result; res(); };
    solicitud.onerror = rej;
  });
}

async function guardarValor(clave, valor) {
  localStorage.setItem('codex_' + clave, JSON.stringify(valor));
  return new Promise(res => {
    const tx = baseDatos.transaction('perfil', 'readwrite');
    tx.objectStore('perfil').put(valor, clave);
    tx.oncomplete = res;
  });
}

async function leerValor(clave) {
  const local = localStorage.getItem('codex_' + clave);
  if (local) return JSON.parse(local);
  return new Promise(res => {
    const tx = baseDatos.transaction('perfil');
    const solicitud = tx.objectStore('perfil').get(clave);
    solicitud.onsuccess = () => res(solicitud.result || null);
  });
}

// ✅ GUARDAR MENSAJE — corregido y con respaldo doble
async function guardarMensaje(conQuien, mensaje) {
  console.log('💾 Guardando mensaje para', conQuien, '→', mensaje);
  
  // Asegurar que el mensaje tenga todos los campos
  const mensajeLimpio = {
    id: `${conQuien}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    conQuien: conQuien,
    de: mensaje.de || '',
    para: mensaje.para || '',
    tipo: mensaje.tipo || 'mensaje',
    texto: mensaje.texto || '',
    datos: mensaje.datos || '',
    propio: !!mensaje.propio,
    fecha: mensaje.fecha || Date.now()
  };

  // Actualizar en memoria primero
  if (!contactos[conQuien]) {
    contactos[conQuien] = {
      mensajes: [],
      ultimoMensaje: '',
      ultimoTiempo: 0,
      leido: true
    };
  }
  contactos[conQuien].mensajes.push(mensajeLimpio);
  
  const preview = 
    mensajeLimpio.tipo === 'imagen' ? '[Imagen]' :
    mensajeLimpio.tipo === 'video' ? '[Video]' :
    mensajeLimpio.tipo === 'audio' ? '[Nota de voz]' :
    mensajeLimpio.texto || '[Mensaje vacío]';
  
  contactos[conQuien].ultimoMensaje = preview;
  contactos[conQuien].ultimoTiempo = mensajeLimpio.fecha;
  
  // Guardar respaldo en localStorage
  guardarChatsEnLocal();
  
  // También guardar en IndexedDB
  return new Promise((res) => {
    if (!baseDatos) { res(); return; }
    const tx = baseDatos.transaction('chats', 'readwrite');
    tx.objectStore('chats').put(mensajeLimpio);
    tx.oncomplete = () => { console.log('✅ Mensaje guardado en DB'); res(); };
    tx.onerror = () => res();
  });
}

// ✅ CARGAR CHATS AL INICIO
async function cargarChatsGuardados() {
  console.log('📂 Cargando chats guardados...');
  
  // Primero intentar con localStorage (más confiable en móvil)
  const respaldoLocal = cargarChatsDeLocal();
  if (Object.keys(respaldoLocal).length > 0) {
    console.log('✅ Usando respaldo de localStorage');
    return respaldoLocal;
  }
  
  // Si no hay respaldo, intentar IndexedDB
  if (!baseDatos) return {};
  
  return new Promise((res) => {
    const tx = baseDatos.transaction('chats');
    const todos = tx.objectStore('chats').getAll();
    todos.onsuccess = () => {
      const mapa = {};
      todos.result.forEach(msg => {
        if (!msg.conQuien) return;
        if (!mapa[msg.conQuien]) {
          mapa[msg.conQuien] = {
            mensajes: [],
            ultimoMensaje: '',
            ultimoTiempo: 0,
            leido: true
          };
        }
        mapa[msg.conQuien].mensajes.push(msg);
        const preview = 
          msg.tipo === 'imagen' ? '[Imagen]' :
          msg.tipo === 'video' ? '[Video]' :
          msg.tipo === 'audio' ? '[Nota de voz]' :
          msg.texto || '[Mensaje vacío]';
        mapa[msg.conQuien].ultimoMensaje = preview;
        mapa[msg.conQuien].ultimoTiempo = msg.fecha;
      });
      console.log(`✅ Cargados ${todos.result.length} mensajes de IndexedDB`);
      res(mapa);
    };
    todos.onerror = () => {
      console.log('⚠️ Error leyendo DB, empezando vacío');
      res({});
    };
  });
}

async function marcarComoLeido(numero) {
  if (contactos[numero]) contactos[numero].leido = true;
  delete mensajesSinLeer[numero];
  actualizarContadorGlobal();
  guardarChatsEnLocal();
}

async function guardarLlamada(datos) {
  return new Promise(res => {
    const historial = JSON.parse(localStorage.getItem('codex_llamadas') || '[]');
    historial.unshift({ ...datos, fecha: Date.now() });
    localStorage.setItem('codex_llamadas', JSON.stringify(historial));
    res();
  });
}

async function leerLlamadas() {
  return JSON.parse(localStorage.getItem('codex_llamadas') || '[]');
}

function actualizarContadorGlobal() {
  const total = Object.values(mensajesSinLeer).reduce((a, b) => a + b, 0);
  contadorGlobalSinLeer.style.display = total > 0 ? 'flex' : 'none';
  contadorGlobalSinLeer.textContent = total > 99 ? '99+' : total;
}

// 🔄 RECONEXIÓN
async function reconectar() {
  if (!miId || reconectandoActivo) return;
  
  console.log('🔄 Reconectando como:', miId);
  reconectandoActivo = true;
  
  if (peer) {
    peer.off('open');
    peer.off('connection');
    peer.off('call');
    peer.off('error');
    peer.destroy();
    peer = null;
  }

  estadoConexion.textContent = 'Reconectando...';
  estadoConexion.className = 'estado-texto estado-reintentando';
  btnConectar.textContent = 'Conectando...';
  btnConectar.disabled = true;

  peer = new Peer(miId, { debug: 2 });

  peer.on('open', () => {
    console.log('✅ Conectado como:', miId);
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
    console.log('⚠️ Conexión cerrada');
    if (!reconectandoActivo) setTimeout(reconectar, 3000);
  });

  peer.on('error', err => {
    console.error('❌ Error:', err.type);
    reconectandoActivo = false;
    
    if (err.type === 'unavailable-id') {
      estadoConexion.textContent = 'Número en uso en otro dispositivo';
      estadoConexion.className = 'estado-texto estado-desconectado';
      btnConectar.disabled = false;
      btnConectar.textContent = 'Conectar';
    } else if (err.type !== 'peer-unavailable') {
      estadoConexion.textContent = 'Reconectando...';
      estadoConexion.className = 'estado-texto estado-reintentando';
      setTimeout(reconectar, 3000);
    }
  });
}

// INICIO
async function iniciar() {
  console.log('🚀 Iniciando Codex...');
  
  await iniciarDB();
  
  const numeroGuardado = await leerValor('miNumero');
  if (numeroGuardado) {
    miNumeroInput.value = numeroGuardado;
    miId = numeroGuardado;
    setTimeout(reconectar, 800);
  }

  // Cargar todos los mensajes guardados
  contactos = await cargarChatsGuardados();
  console.log('📋 Chats cargados:', Object.keys(contactos));
  
  // Contar mensajes sin leer
  Object.keys(contactos).forEach(numero => {
    if (!contactos[numero].leido) {
      mensajesSinLeer[numero] = 1;
    }
  });
  actualizarContadorGlobal();
  
  renderizarListaChats();
  renderizarListaContactos();
  renderizarListaLlamadas();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && miId && (!peer || !peer.open)) {
      console.log('👀 Página activa, verificando...');
      setTimeout(reconectar, 300);
    }
  });
  
  setInterval(() => {
    if (miId && peer && peer.open) {
      Object.keys(conexiones).forEach(amigo => enviarLatido(amigo));
    }
  }, LATIDO_INTERVALO);
  
  // Guardar todo antes de cerrar
  window.addEventListener('beforeunload', guardarChatsEnLocal);
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
  if (!numero || numero === miId) { alert('Escribe un número válido'); return; }
  if (!contactos[numero]) {
    contactos[numero] = { mensajes: [], ultimoMensaje: '', ultimoTiempo: 0, leido: true };
  }
  
  if (peer && peer.open) {
    const conn = peer.connect(numero);
    conn.on('open', () => {
      console.log('🔗 Conectado con', numero);
      conexiones[numero] = conn;
      renderizarListaChats();
      renderizarListaContactos();
      abrirChat(numero);
    });
    conn.on('data', d => procesarMensajeRecibido(d, numero));
    conn.on('error', err => console.log('Error conexión:', err));
  } else {
    alert('Espera a estar conectado primero');
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
          estado === 'conectado' ? '#25c557' : estado === 'inactivo' ? '#ffaa00' : '#888'
        }"></div>
        <div>
          <div class="nombre-contacto">${numero}</div>
          <div class="info-mensaje">${estado === 'conectado' ? 'En línea' : estado === 'inactivo' ? 'Recientemente activo' : 'Desconectado'}</div>
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
          estado === 'conectado' ? '#25c557' : estado === 'inactivo' ? '#ffaa00' : '#888'
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
  leerLlamadas().then(llamadas => {
    sinLlamadas.classList.toggle('oculto', llamadas.length > 0);
    llamadas.forEach(l => {
      const div = document.createElement('div');
      div.className = `item-llamada ${l.tipo === 'entrante' ? 'llamada-entrante' : 'llamada-saliente'}`;
      div.innerHTML = `
        <div class="nombre-contacto">${l.numero}</div>
        <div class="info-mensaje">${new Date(l.fecha).toLocaleString()} — ${l.estado}</div>
      `;
      listaLlamadas.appendChild(div);
    });
  });
}

function abrirChat(numero) {
  chatActivo = numero;
  nombreChat.textContent = numero;
  cajaMensajes.innerHTML = '';
  marcarComoLeido(numero);

  console.log(`💬 Abriendo chat con ${numero}, mensajes:`, contactos[numero]?.mensajes?.length || 0);

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
    else if (tipo === 'audio') grabarYEnviarAudio();
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

async function grabarYEnviarAudio() {
  if (!chatActivo || grabandoAudio) return;

  try {
    flujoGrabacion = await navigator.mediaDevices.getUserMedia({ audio: true });
    grabadoraActiva = new MediaRecorder(flujoGrabacion);
    let datosAudio = [];

    grabadoraActiva.ondataavailable = e => datosAudio.push(e.data);
    grabadoraActiva.onstop = async () => {
      const blob = new Blob(datosAudio, { type: 'audio/webm' });
      const lector = new FileReader();
      lector.onload = async function(evento) {
        const mensaje = {
          tipo: 'audio',
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
      lector.readAsDataURL(blob);
      
      flujoGrabacion.getTracks().forEach(t => t.stop());
      grabandoAudio = false;
      flujoGrabacion = null;
      grabadoraActiva = null;
      inputMensaje.placeholder = 'Escribe un mensaje...';
    };

    grabandoAudio = true;
    inputMensaje.placeholder = '🔊 Suelta para enviar...';
    grabadoraActiva.start();
    
    const detener = () => {
      if (grabadoraActiva && grabandoAudio && grabadoraActiva.state === 'recording') {
        grabadoraActiva.stop();
      }
      document.removeEventListener('mouseup', detener);
      document.removeEventListener('touchend', detener);
    };
    document.addEventListener('mouseup', detener);
    document.addEventListener('touchend', detener);
    
  } catch {
    alert('Permiso de micrófono denegado');
    grabandoAudio = false;
  }
}

function renderizarMensaje(m) {
  const div = document.createElement('div');
  div.className = `mensaje ${m.propio ? 'propio' : 'otro'}`;
  const hora = new Date(m.fecha).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  
  const textoSeguro = m.texto || '';
  
  if (m.tipo === 'mensaje' || m.tipo === 'texto') {
    div.innerHTML = `
      <p>${textoSeguro}</p>
      <p class="hora">${hora}</p>
    `;
  } else if (m.tipo === 'imagen') {
    div.innerHTML = `
      <img src="${m.datos}" style="max-width:200px;border-radius:8px;">
      <p class="hora">${hora}</p>
    `;
  } else if (m.tipo === 'video') {
    div.innerHTML = `
      <video controls style="max-width:200px;border-radius:8px;"><source src="${m.datos}"></video>
      <p class="hora">${hora}</p>
    `;
  } else if (m.tipo === 'audio') {
    div.innerHTML = `
      <audio controls style="max-width:200px;"><source src="${m.datos}">
      <p class="hora">${hora}</p>
    `;
  }

  cajaMensajes.appendChild(div);
  cajaMensajes.scrollTop = cajaMensajes.scrollHeight;
}

function manejarConexionEntrante(conn) {
  const numero = conn.peer;
  console.log('📥 Conexión entrante de:', numero);
  conexiones[numero] = conn;

  conn.on('data', datos => procesarMensajeRecibido(datos, numero));
  
  conn.on('close', () => {
    console.log('🔌 Conexión cerrada con', numero);
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
    console.log('⚠️ Mensaje no reconocido');
    return;
  }

  if (datos.tipo === 'latido') {
    estadoAmigos[deNumero] = { visto: Date.now(), ok: true };
    return;
  }

  if (datos.tipo === 'latido-respuesta') return;
  
  if (['mensaje', 'imagen', 'video', 'audio'].includes(datos.tipo)) {
    datos.propio = false;
    datos.fecha = datos.fecha || Date.now();
    
    console.log(`📩 Mensaje recibido de ${deNumero}`);
    
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

btnCerrarVisor.addEventListener('click', () => {
  visorCompleto.classList.add('oculto');
  contenidoVisor.innerHTML = '';
});

document.addEventListener('click', e => {
  if (e.target.matches('.mensaje img')) {
    visorCompleto.classList.remove('oculto');
    contenidoVisor.innerHTML = `<img src="${e.target.src}" style="max-width:100%;max-height:100%;">`;
  }
});

btnLlamar.addEventListener('click', async () => {
  if (!chatActivo) return;
  if (!conexiones[chatActivo]?.open) {
    alert('El usuario no está conectado');
    return;
  }
  flujoLocal = await navigator.mediaDevices.getUserMedia({ audio: true });
  llamadaActiva = peer.call(chatActivo, flujoLocal);
  manejarLlamadaComun(llamadaActiva, chatActivo, 'saliente');
});

function manejarLlamadaEntrante(llamada) {
  llamadaActiva = llamada;
  const numero = llamada.peer;
  quienLlama.textContent = `Llamada de: ${numero}`;
  pantallaLlamadaEntrante.classList.remove('oculto');

  btnResponder.onclick = async () => {
    flujoLocal = await navigator.mediaDevices.getUserMedia({ audio: true });
    llamada.answer(flujoLocal);
    pantallaLlamadaEntrante.classList.add('oculto');
    manejarLlamadaComun(llamada, numero, 'entrante');
  };

  btnRechazar.onclick = () => {
    llamada.close();
    pantallaLlamadaEntrante.classList.add('oculto');
  };
}

function manejarLlamadaComun(llamada, numero, tipo) {
  pantallaLlamada.classList.remove('oculto');
  estadoLlamada.textContent = 'Conectando...';
  
  llamada.on('stream', flujoRemoto => {
    estadoLlamada.textContent = 'En llamada';
    const audio = document.createElement('audio');
    audio.srcObject = flujoRemoto;
    audio.autoplay = true;
    audio.id = 'audioRemoto';
    document.body.appendChild(audio);
  });

  llamada.on('close', () => finalizarLlamada(numero, tipo, 'Finalizada'));
  llamada.on('error', () => finalizarLlamada(numero, tipo, 'Fallida'));
  
  guardarLlamada({ numero, tipo, estado: 'En curso' });
}

function finalizarLlamada(numero, tipo, estado) {
  pantallaLlamada.classList.add('oculto');
  pantallaLlamadaEntrante.classList.add('oculto');
  if (flujoLocal) flujoLocal.getTracks().forEach(t => t.stop());
  const audio = document.getElementById('audioRemoto');
  if (audio) audio.remove();
  llamadaActiva = null;
  guardarLlamada({ numero, tipo, estado }).then(renderizarListaLlamadas);
  
  if (chatActivo) pantallaChat.classList.add('activa');
  else pantallaPrincipal.classList.add('activa');
}

btnColgar.addEventListener('click', () => {
  if (llamadaActiva) llamadaActiva.close();
});

// INICIAR TODO
iniciar();
