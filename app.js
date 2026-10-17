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
const audioRemoto = document.getElementById('audioRemoto');

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

// BASE DE DATOS LOCAL
function iniciarDB() {
  return new Promise((res, rej) => {
    const solicitud = indexedDB.open('CodexDB', 1);
    solicitud.onupgradeneeded = e => {
      baseDatos = e.target.result;
      if (!baseDatos.objectStoreNames.contains('perfil')) baseDatos.createObjectStore('perfil');
      if (!baseDatos.objectStoreNames.contains('chats')) baseDatos.createObjectStore('chats');
      if (!baseDatos.objectStoreNames.contains('llamadas')) baseDatos.createObjectStore('llamadas', {autoIncrement:true});
    };
    solicitud.onsuccess = e => { baseDatos = e.target.result; res(); };
    solicitud.onerror = rej;
  });
}

async function guardarValor(clave, valor) {
  return new Promise(res => {
    const tx = baseDatos.transaction('perfil', 'readwrite');
    tx.objectStore('perfil').put(valor, clave);
    tx.oncomplete = res;
  });
}

async function leerValor(clave) {
  return new Promise(res => {
    const tx = baseDatos.transaction('perfil');
    const solicitud = tx.objectStore('perfil').get(clave);
    solicitud.onsuccess = () => res(solicitud.result || null);
  });
}

async function guardarChat(numero, mensaje) {
  return new Promise(res => {
    const tx = baseDatos.transaction('chats', 'readwrite');
    const solicitud = tx.objectStore('chats').get(numero);
    solicitud.onsuccess = () => {
      const chat = solicitud.result || { mensajes: [] };
      chat.mensajes.push({ ...mensaje, fecha: Date.now() });
      chat.ultimoMensaje = mensaje.texto || '[Archivo]';
      chat.ultimaFecha = Date.now();
      chat.leido = chat.leido || false;
      tx.objectStore('chats').put(chat, numero);
      tx.oncomplete = res;
    };
  });
}

async function leerChats() {
  return new Promise(res => {
    const tx = baseDatos.transaction('chats');
    const todos = tx.objectStore('chats').getAll();
    todos.onsuccess = () => {
      const mapa = {};
      todos.result.forEach((chat, i) => {
        const numero = todos.result[i].key;
        mapa[numero] = chat;
      });
      res(mapa);
    };
  });
}

async function marcarComoLeido(numero) {
  return new Promise(res => {
    const tx = baseDatos.transaction('chats', 'readwrite');
    const solicitud = tx.objectStore('chats').get(numero);
    solicitud.onsuccess = () => {
      const chat = solicitud.result;
      if (chat) {
        chat.leido = true;
        tx.objectStore('chats').put(chat, numero);
      }
      tx.oncomplete = res;
    };
    delete mensajesSinLeer[numero];
    actualizarContadorGlobal();
  });
}

async function guardarLlamada(datos) {
  return new Promise(res => {
    const tx = baseDatos.transaction('llamadas', 'readwrite');
    tx.objectStore('llamadas').put({ ...datos, fecha: Date.now() });
    tx.oncomplete = res;
  });
}

async function leerLlamadas() {
  return new Promise(res => {
    const tx = baseDatos.transaction('llamadas');
    const todos = tx.objectStore('llamadas').getAll();
    todos.onsuccess = () => res(todos.result.reverse());
  });
}

// CONTADOR DE MENSAJES SIN LEER
function actualizarContadorGlobal() {
  const total = Object.values(mensajesSinLeer).reduce((a, b) => a + b, 0);
  contadorGlobalSinLeer.style.display = total > 0 ? 'flex' : 'none';
  contadorGlobalSinLeer.textContent = total > 99 ? '99+' : total;
}

// INICIO
async function iniciar() {
  await iniciarDB();
  
  const numeroGuardado = await leerValor('miNumero');
  if (numeroGuardado) {
    miNumeroInput.value = numeroGuardado;
    setTimeout(() => conectar(numeroGuardado), 500);
  }

  contactos = await leerChats();
  Object.keys(contactos).forEach(numero => {
    if (!contactos[numero].leido) {
      mensajesSinLeer[numero] = 1;
    }
  });
  actualizarContadorGlobal();
  
  renderizarListaChats();
  renderizarListaContactos();
  renderizarListaLlamadas();
}

// CONEXIÓN
async function conectar(numero) {
  if (!numero) return;

  if (reconectarTiempo) clearTimeout(reconectarTiempo);
  if (peer) peer.destroy();

  miId = numero;
  await guardarValor('miNumero', numero);

  btnConectar.disabled = true;
  btnConectar.textContent = 'Conectando...';
  estadoConexion.textContent = 'Conectando...';
  estadoConexion.className = 'estado-texto estado-reintentando';

  peer = new Peer(miId);

  peer.on('open', id => {
    miId = id;
    btnConectar.textContent = 'Conectado';
    estadoConexion.textContent = '● En línea';
    estadoConexion.className = 'estado-texto estado-conectado';
    miNumeroInput.readOnly = true;
  });

  peer.on('connection', manejarConexionEntrante);
  peer.on('call', manejarLlamadaEntrante);

  peer.on('error', err => {
    console.error('Error de conexión:', err);
    miNumeroInput.readOnly = false;
    btnConectar.disabled = false;
    btnConectar.textContent = 'Reintentar';
    
    if (err.type === 'unavailable-id') {
      estadoConexion.textContent = 'Número activo en otro dispositivo';
      estadoConexion.className = 'estado-texto estado-desconectado';
    } else {
      estadoConexion.textContent = 'Desconectado — escribe tu número y pulsa Conectar';
      estadoConexion.className = 'estado-texto estado-desconectado';
    }
  });
}

btnConectar.addEventListener('click', () => {
  const numero = miNumeroInput.value.trim();
  if (!numero) { alert('Escribe tu número primero'); return; }
  conectar(numero);
});

// MENÚ INFERIOR
itemsMenu.forEach(item => {
  item.addEventListener('click', () => {
    const nombre = item.dataset.pestana;
    itemsMenu.forEach(i => i.classList.toggle('activa', i === item));
    vistas.forEach(v => v.classList.toggle('activa', v.id === `vista-${nombre}`));
    menuOpciones.classList.remove('mostrar');
  });
});

// AGREGAR USUARIO
btnAgregarUsuario.addEventListener('click', () => {
  const numero = numeroDestinoInput.value.trim();
  if (!numero || numero === miId) { alert('Escribe un número válido'); return; }

  if (!contactos[numero]) contactos[numero] = { mensajes: [] };

  if (peer && peer.open) {
    const conn = peer.connect(numero);
    conn.on('open', () => {
      conexiones[numero] = conn;
      renderizarListaChats();
      renderizarListaContactos();
      abrirChat(numero);
    });
    conn.on('data', d => procesarMensajeRecibido(d, numero));
    conn.on('error', () => alert('No se pudo conectar. El usuario debe estar en línea.'));
  } else {
    alert('Primero conéctate con tu número');
  }

  numeroDestinoInput.value = '';
});

function renderizarListaContactos() {
  listaContactos.innerHTML = '';
  Object.keys(contactos).forEach(numero => {
    const div = document.createElement('div');
    div.className = 'item-contacto';
    div.innerHTML = `
      <div class="nombre-contacto">${numero}</div>
      <div class="info-mensaje">${contactos[numero].ultimoMensaje || 'Sin mensajes'}</div>
    `;
    div.addEventListener('click', () => abrirChat(numero));
    listaContactos.appendChild(div);
  });
}

function renderizarListaChats() {
  listaChats.innerHTML = '';
  const hayChats = Object.keys(contactos).length > 0;
  sinChats.classList.toggle('oculto', hayChats);
  
  Object.entries(contactos)
    .sort((a, b) => (b[1].ultimaFecha || 0) - (a[1].ultimaFecha || 0))
    .forEach(([numero, datos]) => {
      const sinLeer = mensajesSinLeer[numero] && chatActivo !== numero;
      const div = document.createElement('div');
      div.className = 'item-chat';
      div.innerHTML = `
        <div class="nombre-contacto">${numero}</div>
        <div class="info-mensaje">${datos.ultimoMensaje || 'Sin mensajes'}</div>
        ${sinLeer ? '<div class="punto-sin-leer"></div>' : ''}
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
        <div class="info-mensaje">${l.fecha ? new Date(l.fecha).toLocaleString() : ''} — ${l.estado}</div>
      `;
      listaLlamadas.appendChild(div);
    });
  });
}

// ABRIR/ CERRAR CHAT
function abrirChat(numero) {
  chatActivo = numero;
  nombreChat.textContent = numero;
  cajaMensajes.innerHTML = '';
  marcarComoLeido(numero);

  if (peer && peer.open && !conexiones[numero]) {
    const conn = peer.connect(numero);
    conn.on('open', () => conexiones[numero] = conn);
    conn.on('data', d => procesarMensajeRecibido(d, numero));
  }

  if (contactos[numero]?.mensajes) {
    contactos[numero].mensajes.forEach(m => renderizarMensaje(m));
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

// ENVIAR MENSAJES
btnEnviar.addEventListener('click', e => {
  const texto = inputMensaje.value.trim();
  if (texto) {
    enviarMensaje();
  } else if (chatActivo) {
    grabarYEnviarAudio();
  }
});

inputMensaje.addEventListener('keydown', e => {
  if (e.key === 'Enter' && inputMensaje.value.trim()) enviarMensaje();
});

async function enviarMensaje() {
  const texto = inputMensaje.value.trim();
  if (!texto || !chatActivo) return;

  const mensaje = {
    tipo: 'texto', de: miId, para: chatActivo, texto: texto,
    propio: true, fecha: Date.now(), estado: 'enviado'
  };

  if (conexiones[chatActivo]?.open) conexiones[chatActivo].send(mensaje);
  await guardarChat(chatActivo, mensaje);
  if (!contactos[chatActivo]) contactos[chatActivo] = { mensajes: [] };
  contactos[chatActivo].mensajes.push(mensaje);
  renderizarMensaje(mensaje);
  
  inputMensaje.value = '';
  renderizarListaChats();
}

inputImagen.addEventListener('change', async e => {
  const archivo = e.target.files[0];
  if (!archivo || !chatActivo) return;
  const datos = await leerArchivoComoBase64(archivo);
  const mensaje = { tipo: 'imagen', de: miId, para: chatActivo, datos, propio: true, fecha: Date.now(), estado: 'enviado' };
  if (conexiones[chatActivo]?.open) conexiones[chatActivo].send(mensaje);
  await guardarChat(chatActivo, mensaje);
  contactos[chatActivo].mensajes.push(mensaje);
  renderizarMensaje(mensaje);
  inputImagen.value = '';
});

inputVideo.addEventListener('change', async e => {
  const archivo = e.target.files[0];
  if (!archivo || !chatActivo) return;
  const datos = await leerArchivoComoBase64(archivo);
  const mensaje = { tipo: 'video', de: miId, para: chatActivo, datos, propio: true, fecha: Date.now(), estado: 'enviado' };
  if (conexiones[chatActivo]?.open) conexiones[chatActivo].send(mensaje);
  await guardarChat(chatActivo, mensaje);
  contactos[chatActivo].mensajes.push(mensaje);
  renderizarMensaje(mensaje);
  inputVideo.value = '';
});

async function grabarYEnviarAudio() {
  if (!chatActivo || grabandoAudio) return;

  try {
    flujoGrabacion = await navigator.mediaDevices.getUserMedia({ audio: true });
    grabadoraActiva = new MediaRecorder(flujoGrabacion);
    let datosAudio = null;

    grabadoraActiva.ondataavailable = e => datosAudio = e.data;
    grabadoraActiva.onstop = async () => {
      if (!datosAudio) return;
      
      const base64 = await leerArchivoComoBase64(datosAudio);
      const mensaje = {
        tipo: 'audio', de: miId, para: chatActivo,
        datos: base64, propio: true, fecha: Date.now(), estado: 'enviado'
      };
      
      if (conexiones[chatActivo]?.open) conexiones[chatActivo].send(mensaje);
      await guardarChat(chatActivo, mensaje);
      if (!contactos[chatActivo]) contactos[chatActivo] = { mensajes: [] };
      contactos[chatActivo].mensajes.push(mensaje);
      renderizarMensaje(mensaje);
      
      flujoGrabacion.getTracks().forEach(t => t.stop());
      grabandoAudio = false;
      flujoGrabacion = null;
      grabadoraActiva = null;
      inputMensaje.placeholder = 'Escribe un mensaje...';
    };

    grabandoAudio = true;
    inputMensaje.placeholder = '🔊 Grabando... suelta para enviar';
    grabadoraActiva.start();

    const detenerGrabacion = () => {
      if (grabadoraActiva && grabandoAudio && grabadoraActiva.state === 'recording') {
        grabadoraActiva.stop();
      }
      btnEnviar.removeEventListener('mouseup', detenerGrabacion);
      btnEnviar.removeEventListener('touchend', detenerGrabacion);
      document.removeEventListener('mouseup', detenerGrabacion);
      document.removeEventListener('touchend', detenerGrabacion);
    };

    btnEnviar.addEventListener('mouseup', detenerGrabacion);
    btnEnviar.addEventListener('touchend', detenerGrabacion);
    document.addEventListener('mouseup', detenerGrabacion);
    document.addEventListener('touchend', detenerGrabacion);

    setTimeout(() => {
      if (grabandoAudio && grabadoraActiva?.state === 'recording') {
        grabadoraActiva.stop();
      }
    }, 60000);

  } catch {
    alert('Permiso de micrófono denegado');
    grabandoAudio = false;
  }
}

function leerArchivoComoBase64(archivo) {
  return new Promise(res => {
    const lector = new FileReader();
    lector.onload = () => res(lector.result);
    lector.readAsDataURL(archivo);
  });
}

function renderizarMensaje(m) {
  const div = document.createElement('div');
  div.className = `mensaje ${m.propio ? 'propio' : 'otro'}`;
  const hora = new Date(m.fecha).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const estadoClase = m.propio ? `estado-${m.estado || 'enviado'}` : '';
  
  if (m.tipo === 'texto') {
    div.innerHTML = `
      <p>${m.texto}</p>
      <p class="hora">${hora}${m.propio ? `<span class="estado-mensaje ${estadoClase}"></span>` : ''}</p>
    `;
  } else if (m.tipo === 'imagen') {
    div.innerHTML = `
      <img src="${m.datos}" alt="Imagen">
      <p class="hora">${hora}${m.propio ? `<span class="estado-mensaje ${estadoClase}"></span>` : ''}</p>
    `;
  } else if (m.tipo === 'video') {
    div.innerHTML = `
      <video controls src="${m.datos}"></video>
      <p class="hora">${hora}${m.propio ? `<span class="estado-mensaje ${estadoClase}"></span>` : ''}</p>
    `;
  } else if (m.tipo === 'audio') {
    div.innerHTML = `
      <audio controls src="${m.datos}">
      <p class="hora">${hora}${m.propio ? `<span class="estado-mensaje ${estadoClase}"></span>` : ''}</p>
    `;
  }

  cajaMensajes.appendChild(div);
  cajaMensajes.scrollTop = cajaMensajes.scrollHeight;
}

// RECIBIR MENSAJES — CONEXIÓN BIDIRECCIONAL
function manejarConexionEntrante(conn) {
  const numero = conn.peer;
  conexiones[numero] = conn;
  if (!contactos[numero]) contactos[numero] = { mensajes: [] };

  conn.on('data', datos => procesarMensajeRecibido(datos, numero));
  conn.on('close', () => delete conexiones[numero]);

  if (!conexiones[numero]?.open && peer && peer.open) {
    const connSalida = peer.connect(numero);
    connSalida.on('open', () => {
      conexiones[numero] = connSalida;
    });
    connSalida.on('data', datos => procesarMensajeRecibido(datos, numero));
  }
  
  renderizarListaChats();
  renderizarListaContactos();
}

async function procesarMensajeRecibido(datos, deNumero) {
  if (datos.tipo === 'llamada') return;

  datos.propio = false;
  await guardarChat(deNumero, datos);
  if (!contactos[deNumero]) contactos[deNumero] = { mensajes: [] };
  contactos[deNumero].mensajes.push(datos);
  
  if (chatActivo === deNumero) {
    renderizarMensaje(datos);
  } else {
    contactos[deNumero].leido = false;
    mensajesSinLeer[deNumero] = (mensajesSinLeer[deNumero] || 0) + 1;
    actualizarContadorGlobal();
  }
  
  renderizarListaChats();
}

// VISOR PANTALLA COMPLETA
btnCerrarVisor.addEventListener('click', () => {
  visorCompleto.classList.add('oculto');
  contenidoVisor.innerHTML = '';
});

document.addEventListener('click', e => {
  if (e.target.matches('.mensaje img') || e.target.matches('.mensaje video')) {
    e.preventDefault();
    const elemento = e.target.cloneNode(true);
    elemento.controls = true;
    contenidoVisor.innerHTML = '';
    contenidoVisor.appendChild(elemento);
    visorCompleto.classList.remove('oculto');
  }
});

// LLAMADAS
btnLlamar.addEventListener('click', async () => {
  if (!chatActivo || !conexiones[chatActivo]?.open) {
    alert('El usuario debe estar conectado para llamar');
    return;
  }
  flujoLocal = await navigator.mediaDevices.getUserMedia({ audio: true });
  llamadaActiva = peer.call(chatActivo, flujoLocal);
  manejarLlamadaComun(llamadaActiva, chatActivo, 'saliente');
});

function manejarLlamadaEntrante(llamada) {
  llamadaActiva = llamada;
  quienLlama.textContent = `Te llama: ${llamada.peer}`;
  pantallaChat.classList.remove('activa');
  pantallaPrincipal.classList.remove('activa');
  pantallaLlamadaEntrante.classList.add('activa');

  btnResponder.onclick = async () => {
    flujoLocal = await navigator.mediaDevices.getUserMedia({ audio: true });
    llamada.answer(flujoLocal);
    pantallaLlamadaEntrante.classList.remove('activa');
    manejarLlamadaComun(llamada, llamada.peer, 'entrante');
  };

  btnRechazar.onclick = () => {
    llamada.close();
    pantallaLlamadaEntrante.classList.remove('activa');
    pantallaPrincipal.classList.add('activa');
  };
}

function manejarLlamadaComun(llamada, numero, tipo) {
  pantallaLlamada.classList.add('activa');
  estadoLlamada.textContent = 'Conectando...';
  guardarLlamada({ numero, tipo, estado: 'En curso' }).then(renderizarListaLlamadas);

  llamada.on('stream', flujoRemoto => {
    audioRemoto.srcObject = flujoRemoto;
    estadoLlamada.textContent = 'En llamada';
  });

  llamada.on('close', () => finalizarLlamada(numero, tipo, 'Finalizada'));
  llamada.on('error', () => finalizarLlamada(numero, tipo, 'Fallida'));
}

function finalizarLlamada(numero, tipo, estado) {
  pantallaLlamada.classList.remove('activa');
  if (flujoLocal) flujoLocal.getTracks().forEach(t => t.stop());
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
