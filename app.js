// ==========================================
// CODEx - JavaScript CORREGIDO
// ==========================================

// ---------- ELEMENTOS DEL DOM ----------
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
const textoNombreChat = document.getElementById('textoNombreChat');
const subtituloChat = document.getElementById('subtituloChat');
const cajaMensajes = document.getElementById('cajaMensajes');
const inputMensaje = document.getElementById('inputMensaje');
const btnEnviar = document.getElementById('btnEnviar');
const btnVolver = document.getElementById('btnVolver');
const btnLlamar = document.getElementById('btnLlamar');
const btnVerPerfil = document.getElementById('btnVerPerfil');
const btnOpciones = document.getElementById('btnOpciones');
const menuOpciones = document.getElementById('menuOpciones');

// Perfil Modal
const perfilUsuarioModal = document.getElementById('perfilUsuarioModal');
const btnCerrarPerfil = document.getElementById('btnCerrarPerfil');
const fotoPerfilGrande = document.getElementById('fotoPerfilGrande');
const inicialPerfil = document.getElementById('inicialPerfil');
const puntoEstado = document.querySelector('.punto-estado');
const textoEstado = document.getElementById('textoEstado');
const nombrePerfil = document.getElementById('nombrePerfil');
const numeroPerfil = document.getElementById('numeroPerfil');
const btnEditarNombre = document.getElementById('btnEditarNombre');
const btnGuardarPerfil = document.getElementById('btnGuardarPerfil');

// Eliminar Chat
const menuEliminarChat = document.getElementById('menuEliminarChat');
const opcionEliminarChat = document.getElementById('opcionEliminarChat');
let chatPulsado = null;
let temporizadorPulsar = null;

// Barra Llamada Activa
const barraLlamadaActiva = document.getElementById('barraLlamadaActiva');
const numeroLlamadaBarra = document.getElementById('numeroLlamadaBarra');
const tiempoLlamadaBarra = document.getElementById('tiempoLlamadaBarra');
const btnMinimizarLlamada = document.getElementById('btnMinimizarLlamada');
const btnSilenciarBarra = document.getElementById('btnSilenciarBarra');
const btnAltavozBarra = document.getElementById('btnAltavozBarra');
const btnCamaraBarra = document.getElementById('btnCamaraBarra');
const btnChatDesdeLlamada = document.getElementById('btnChatDesdeLlamada');
const btnColgarBarra = document.getElementById('btnColgarBarra');

// Pantalla Llamada
const pantallaLlamada = document.getElementById('pantallaLlamada');
const estadoLlamada = document.getElementById('estadoLlamada');
const avatarLlamada = document.getElementById('avatarLlamada');
const numeroLlamadaGrande = document.getElementById('numeroLlamadaGrande');
const tiempoLlamadaGrande = document.getElementById('tiempoLlamadaGrande');
const btnSilenciarLlamada = document.getElementById('btnSilenciarLlamada');
const btnAltavozLlamada = document.getElementById('btnAltavozLlamada');
const btnCamaraLlamada = document.getElementById('btnCamaraLlamada');
const btnMinimizarPantallaLlamada = document.getElementById('btnMinimizarPantallaLlamada');
const btnColgarPantalla = document.getElementById('btnColgarPantalla');

// Llamada Entrante
const pantallaLlamadaEntrante = document.getElementById('pantallaLlamadaEntrante');
const avatarLlamadaEntrante = document.getElementById('avatarLlamadaEntrante');
const quienLlama = document.getElementById('quienLlama');
const btnRechazar = document.getElementById('btnRechazar');
const btnResponder = document.getElementById('btnResponder');

// Menú tipo de llamada
let menuTipoLlamada = null;

// Inputs archivos
const inputImagen = document.getElementById('inputImagen');
const inputVideo = document.getElementById('inputVideo');

// ---------- VARIABLES GLOBALES ----------
let miNumero = localStorage.getItem('codex_numero') || '';
let miNombreGuardado = localStorage.getItem('codex_nombre') || '';
let peer = null;
let conexionActiva = null;
let llamadaActiva = null;
let llamadaEntrante = null;
let streamLocal = null;
let conexionSaliente = null;
let contactoActual = null;

// ⚠️ ¡CLAVE! Leemos TODO desde localStorage al iniciar
let conversaciones = {};
let contactos = {};
let historialLlamadas = [];

function cargarDatos() {
  try {
    const chatsGuardados = localStorage.getItem('codex_chats');
    const contactosGuardados = localStorage.getItem('codex_contactos');
    const llamadasGuardadas = localStorage.getItem('codex_llamadas');
    
    conversaciones = chatsGuardados ? JSON.parse(chatsGuardados) : {};
    contactos = contactosGuardados ? JSON.parse(contactosGuardados) : {};
    historialLlamadas = llamadasGuardadas ? JSON.parse(llamadasGuardadas) : [];
    
    console.log('✅ Datos cargados:', { conversaciones, contactos, historialLlamadas });
  } catch (e) {
    console.error('Error al cargar datos:', e);
    conversaciones = {};
    contactos = {};
    historialLlamadas = [];
  }
}

let temporizadorLlamada = null;
let segundosLlamada = 0;
let llamadaMinimizada = false;
let silenciado = false;
let altavozActivo = true;
let camaraActiva = false;
let mensajesPendientes = {};

// ---------- INICIALIZACIÓN ----------
function init() {
  cargarDatos(); // ⚠️ Primero cargamos TODO
  
  // Restaurar número
  if (miNumero) {
    miNumeroInput.value = miNumero;
    conectarPeer();
  }
  
  // Restaurar nombre
  if (miNombreGuardado) {
    nombrePerfil.value = miNombreGuardado;
  } else {
    nombrePerfil.value = miNumero;
  }
  
  renderizarContactos();
  renderizarChats();
  renderizarLlamadas();
  actualizarContadorSinLeer();
  configurarEventos();
}

// ---------- CONEXIÓN PEERJS ----------
function conectarPeer() {
  if (!miNumero) return;
  
  estadoConexion.textContent = 'Conectando...';
  estadoConexion.className = 'estado-texto estado-reintentando';
  
  peer = new Peer(miNumero, { host: 'peerjs-server.onrender.com', port: 443, path: '/', secure: true, debug: 0 });
  
  peer.on('open', () => {
    estadoConexion.textContent = 'Conectado ✅';
    estadoConexion.className = 'estado-texto estado-conectado';
    localStorage.setItem('codex_numero', miNumero);
  });
  
  peer.on('connection', (conn) => {
    manejarConexionEntrante(conn);
  });
  
  peer.on('call', (call) => {
    manejarLlamadaEntrante(call);
  });
  
  peer.on('close', () => {
    estadoConexion.textContent = 'Desconectado';
    estadoConexion.className = 'estado-texto estado-desconectado';
    setTimeout(conectarPeer, 5000);
  });
  
  peer.on('error', (err) => {
    console.error('Error Peer:', err);
    estadoConexion.textContent = 'Reconectando...';
    estadoConexion.className = 'estado-texto estado-reintentando';
    setTimeout(conectarPeer, 5000);
  });
}

// ---------- MANEJAR CONEXIONES ----------
function manejarConexionEntrante(conn) {
  conexionActiva = conn;
  const numeroRemitente = conn.peer;
  
  conn.on('data', (datos) => {
    procesarMensaje(datos, numeroRemitente);
  });
  
  conn.on('close', () => {
    actualizarEstadoContacto(numeroRemitente, false);
  });
  
  conn.on('error', () => {
    actualizarEstadoContacto(numeroRemitente, false);
  });
  
  conn.send({ tipo: 'estado', de: miNumero, nombre: miNombreGuardado || miNumero, conectado: true });
  actualizarEstadoContacto(numeroRemitente, true);
}

function conectarConUsuario(destino) {
  if (!peer) return;
  
  const conn = peer.connect(destino);
  
  conn.on('open', () => {
    conexionActiva = conn;
    
    conn.on('data', (datos) => {
      procesarMensaje(datos, destino);
    });
    
    conn.on('close', () => {
      actualizarEstadoContacto(destino, false);
    });
    
    conn.send({ tipo: 'estado', de: miNumero, nombre: miNombreGuardado || miNumero, conectado: true });
    actualizarEstadoContacto(destino, true);
  });
  
  conn.on('error', (err) => {
    console.error('Error conexión:', err);
  });
  
  conexionSaliente = conn;
  return conn;
}

// ---------- PROCESAR MENSAJES ----------
function procesarMensaje(datos, deQuien) {
  switch (datos.tipo) {
    case 'mensaje':
      recibirMensaje(datos, deQuien);
      break;
    case 'estado':
      actualizarNombreYEstado(deQuien, datos.nombre, datos.conectado);
      break;
    case 'recibido':
      marcarComoEntregado(datos.idMensaje, deQuien);
      break;
    case 'leido':
      marcarComoLeido(datos.idChat, deQuien);
      break;
    case 'fin-llamada':
      finalizarLlamada();
      break;
  }
}

function recibirMensaje(datos, deQuien) {
  if (!conversaciones[deQuien]) conversaciones[deQuien] = [];
  
  conversaciones[deQuien].push({
    id: datos.id,
    texto: datos.texto,
    tipo: datos.tipoMensaje || 'texto',
    hora: datos.hora,
    propio: false,
    estado: 'recibido'
  });
  
  guardarConversaciones(); // ⚠️ Guardamos INMEDIATAMENTE
  
  if (conexionActiva && conexionActiva.open) {
    conexionActiva.send({ tipo: 'recibido', idMensaje: datos.id });
  }
  
  if (contactoActual === deQuien) {
    if (conexionActiva && conexionActiva.open) {
      conexionActiva.send({ tipo: 'leido', idChat: deQuien });
    }
    conversaciones[deQuien].ultimaLeida = Date.now();
    guardarConversaciones();
  }
  
  renderizarChats();
  renderizarContactos();
  
  if (contactoActual === deQuien) {
    renderizarMensajes(deQuien);
  } else {
    actualizarContadorSinLeer();
  }
}

function marcarComoEntregado(idMensaje, deQuien) {
  if (!conversaciones[deQuien]) return;
  const msg = conversaciones[deQuien].find(m => m.id === idMensaje && m.propio);
  if (msg && msg.estado === 'enviado') {
    msg.estado = 'entregado';
    guardarConversaciones();
    if (contactoActual === deQuien) renderizarMensajes(deQuien);
  }
}

function marcarComoLeido(idChat, deQuien) {
  if (!conversaciones[deQuien]) return;
  conversaciones[deQuien].forEach(m => {
    if (m.propio && m.estado !== 'leido') m.estado = 'leido';
  });
  conversaciones[deQuien].ultimaLeida = Date.now();
  guardarConversaciones();
  renderizarChats();
  if (contactoActual === deQuien) renderizarMensajes(deQuien);
}

function actualizarNombreYEstado(numero, nombre, conectado) {
  if (!contactos[numero]) contactos[numero] = { nombre: numero };
  if (nombre && nombre !== numero) contactos[numero].nombre = nombre;
  contactos[numero].conectado = conectado;
  contactos[numero].ultimaVisto = conectado ? 'En línea' : 'Desconectado';
  guardarContactos(); // ⚠️ Guardamos cambios
  renderizarContactos();
  renderizarChats();
  if (contactoActual === numero) actualizarSubtituloChat(numero);
}

function actualizarEstadoContacto(numero, conectado) {
  if (contactos[numero]) {
    contactos[numero].conectado = conectado;
    contactos[numero].ultimaVisto = conectado ? 'En línea' : 'Desconectado';
    guardarContactos();
    renderizarContactos();
    renderizarChats();
    if (contactoActual === numero) actualizarSubtituloChat(numero);
  }
}

function actualizarSubtituloChat(numero) {
  const c = contactos[numero];
  if (c) subtituloChat.textContent = c.conectado ? 'En línea' : 'Desconectado';
}

// ---------- CHATS ----------
function abrirChat(numero) {
  contactoActual = numero;
  
  // ⚠️ Si el contacto no existe, lo creamos automáticamente
  if (!contactos[numero]) {
    contactos[numero] = { nombre: numero };
    guardarContactos();
    renderizarContactos();
  }
  
  document.body.classList.add('con-chat-abierto');
  pantallaPrincipal.classList.remove('activa');
  pantallaChat.classList.add('activa');
  
  const nombreMostrar = contactos[numero]?.nombre || numero;
  textoNombreChat.textContent = nombreMostrar;
  numeroPerfil.textContent = numero;
  inicialPerfil.textContent = (contactos[numero]?.nombre || numero).charAt(0).toUpperCase();
  nombrePerfil.value = contactos[numero]?.nombrePersonal || contactos[numero]?.nombre || numero;
  
  if (contactos[numero]?.conectado) {
    puntoEstado.classList.add('conectado');
    textoEstado.textContent = 'En línea';
  } else {
    puntoEstado.classList.remove('conectado');
    textoEstado.textContent = contactos[numero]?.ultimaVisto || 'Desconocido';
  }
  
  if (conversaciones[numero]) {
    conversaciones[numero].ultimaLeida = Date.now();
    if (conexionActiva && conexionActiva.open) {
      conexionActiva.send({ tipo: 'leido', idChat: numero });
    }
    guardarConversaciones();
  }
  
  renderizarMensajes(numero);
  actualizarContadorSinLeer();
  
  if (!conexionActiva || conexionActiva.peer !== numero) {
    conectarConUsuario(numero);
  }
}

function cerrarChat() {
  document.body.classList.remove('con-chat-abierto');
  pantallaChat.classList.remove('activa');
  pantallaPrincipal.classList.add('activa');
  contactoActual = null;
  cajaMensajes.innerHTML = '';
  menuOpciones.classList.remove('mostrar');
}

function enviarMensaje(texto, tipo = 'texto', datosExtra = null) {
  if (!contactoActual) return;
  if (!conversaciones[contactoActual]) conversaciones[contactoActual] = [];
  
  const id = Date.now() + Math.random();
  const mensaje = {
    id,
    texto,
    tipo: 'mensaje',
    tipoMensaje: tipo,
    hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    propio: true,
    estado: 'enviado',
    ...datosExtra
  };
  
  conversaciones[contactoActual].push(mensaje);
  guardarConversaciones(); // ⚠️ Guardamos inmediatamente
  
  if (conexionActiva && conexionActiva.open) {
    conexionActiva.send({
      tipo: 'mensaje',
      id,
      texto,
      tipoMensaje: tipo,
      hora: mensaje.hora
    });
  } else {
    if (!mensajesPendientes[contactoActual]) mensajesPendientes[contactoActual] = [];
    mensajesPendientes[contactoActual].push(mensaje);
  }
  
  renderizarMensajes(contactoActual);
  renderizarChats();
  inputMensaje.value = '';
  cajaMensajes.scrollTop = cajaMensajes.scrollHeight;
}

function renderizarMensajes(numero) {
  cajaMensajes.innerHTML = '';
  const mensajes = conversaciones[numero] || [];
  
  if (mensajes.length === 0) {
    cajaMensajes.innerHTML = '<p class="texto-vacio">No hay mensajes aún. ¡Escribe el primero!</p>';
    return;
  }
  
  mensajes.forEach(msg => {
    const div = document.createElement('div');
    div.className = `mensaje ${msg.propio ? 'propio' : 'otro'}`;
    
    if (msg.tipoMensaje === 'texto') {
      div.innerHTML = `
        <div>${msg.texto}</div>
        <div class="hora">${msg.hora}${msg.propio ? `<span class="estado-mensaje estado-${msg.estado || 'enviado'}"></span>` : ''}</div>
      `;
    } else if (msg.tipoMensaje === 'imagen') {
      div.innerHTML = `
        <img src="${msg.texto}" loading="lazy">
        <div class="hora">${msg.hora}${msg.propio ? `<span class="estado-mensaje estado-${msg.estado || 'enviado'}"></span>` : ''}</div>
      `;
      div.querySelector('img').onclick = () => abrirVisor(msg.texto, 'imagen');
    } else if (msg.tipoMensaje === 'video') {
      div.innerHTML = `
        <video src="${msg.texto}" controls></video>
        <div class="hora">${msg.hora}${msg.propio ? `<span class="estado-mensaje estado-${msg.estado || 'enviado'}"></span>` : ''}</div>
      `;
      div.querySelector('video').onclick = () => abrirVisor(msg.texto, 'video');
    }
    
    cajaMensajes.appendChild(div);
  });
  
  cajaMensajes.scrollTop = cajaMensajes.scrollHeight;
}

function eliminarConversacion(numero) {
  if (confirm('¿Eliminar esta conversación?')) {
    delete conversaciones[numero];
    guardarConversaciones();
    renderizarChats();
    renderizarContactos();
    menuEliminarChat.classList.add('oculto');
  }
}

// ---------- LLAMADAS - CORREGIDO ----------
function mostrarMenuTipoLlamada() {
  if (!contactoActual) return;
  
  // El que LLAMA elige el tipo, NO el que recibe
  const tipoLlamada = confirm('¿Llamada con video?\n\n✅ Aceptar = Videollamada\n❌ Cancelar = Llamada de voz');
  iniciarLlamada(contactoActual, tipoLlamada);
}

async function iniciarLlamada(numeroDestino, esVideo = false) {
  try {
    console.log(`📞 Iniciando ${esVideo ? 'VIDEOLLAMADA' : 'LLAMADA'} a:`, numeroDestino);
    
    streamLocal = await navigator.mediaDevices.getUserMedia({ 
      audio: true, 
      video: esVideo 
    });
    
    llamadaActiva = peer.call(numeroDestino, streamLocal);
    
    const nombreDestino = contactos[numeroDestino]?.nombre || numeroDestino;
    numeroLlamadaBarra.textContent = nombreDestino;
    numeroLlamadaGrande.textContent = nombreDestino;
    avatarLlamada.textContent = nombreDestino.charAt(0).toUpperCase();
    
    // ⚠️ Mostramos AMBAS barras
    barraLlamadaActiva.classList.remove('oculto');
    pantallaLlamada.classList.add('activa');
    estadoLlamada.textContent = 'Llamando...';
    
    iniciarTemporizador(); // ⚠️ Iniciamos el reloj
    
    llamadaActiva.on('stream', (streamRemoto) => {
      console.log('📡 Llamada conectada');
      estadoLlamada.textContent = 'En llamada';
    });
    
    llamadaActiva.on('close', finalizarLlamada);
    llamadaActiva.on('error', (err) => {
      console.error('Error en llamada:', err);
      finalizarLlamada();
    });
    
    registrarLlamada(numeroDestino, 'saliente');
    
  } catch (err) {
    console.error('❌ Error al iniciar llamada:', err);
    alert('No se pudo acceder al micrófono/cámara: ' + err.message);
  }
}

function manejarLlamadaEntrante(call) {
  console.log('📞 Llamada entrante de:', call.peer);
  llamadaEntrante = call;
  const deQuien = call.peer;
  
  // ⚠️ Si no tenemos al contacto, lo agregamos automáticamente
  if (!contactos[deQuien]) {
    contactos[deQuien] = { nombre: deQuien };
    guardarContactos();
    renderizarContactos();
  }
  
  const nombreLLamador = contactos[deQuien]?.nombre || deQuien;
  numeroLlamadaBarra.textContent = nombreLLamador;
  quienLlama.textContent = nombreLLamador;
  avatarLlamadaEntrante.textContent = nombreLLamador.charAt(0).toUpperCase();
  
  pantallaLlamadaEntrante.classList.remove('oculto');
  barraLlamadaActiva.classList.remove('oculto');
  
  registrarLlamada(deQuien, 'entrante');
}

async function responderLlamada() {
  if (!llamadaEntrante) return;
  
  pantallaLlamadaEntrante.classList.add('oculto');
  
  try {
    console.log('📞 Respondiendo llamada...');
    streamLocal = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    llamadaEntrante.answer(streamLocal);
    llamadaActiva = llamadaEntrante;
    
    const nombreLLamador = contactos[llamadaActiva.peer]?.nombre || llamadaActiva.peer;
    numeroLlamadaGrande.textContent = nombreLLamador;
    avatarLlamada.textContent = nombreLLamador.charAt(0).toUpperCase();
    
    pantallaLlamada.classList.add('activa');
    estadoLlamada.textContent = 'Conectando...';
    iniciarTemporizador();
    
    llamadaActiva.on('stream', () => {
      estadoLlamada.textContent = 'En llamada';
    });
    
    llamadaActiva.on('close', finalizarLlamada);
    llamadaActiva.on('error', finalizarLlamada);
    
  } catch (err) {
    console.error('❌ Error al responder:', err);
    finalizarLlamada();
  }
}

function rechazarLlamada() {
  if (llamadaEntrante) llamadaEntrante.close();
  finalizarLlamada();
}

function finalizarLlamada() {
  console.log('📞 Colgando llamada...');
  
  if (llamadaActiva) {
    try { llamadaActiva.close(); } catch(e) {}
    llamadaActiva = null;
  }
  if (llamadaEntrante) {
    try { llamadaEntrante.close(); } catch(e) {}
    llamadaEntrante = null;
  }
  
  if (streamLocal) {
    streamLocal.getTracks().forEach(track => track.stop());
    streamLocal = null;
  }
  
  detenerTemporizador();
  barraLlamadaActiva.classList.add('oculto');
  pantallaLlamada.classList.remove('activa');
  pantallaLlamadaEntrante.classList.add('oculto');
  llamadaMinimizada = false;
  silenciado = false;
  camaraActiva = false;
  actualizarBotonesLlamada();
  
  if (conexionActiva && conexionActiva.open) {
    conexionActiva.send({ tipo: 'fin-llamada' });
  }
}

function minimizarLlamada() {
  pantallaLlamada.classList.remove('activa');
  llamadaMinimizada = true;
}

function maximizarLlamada() {
  if (llamadaActiva || llamadaEntrante) {
    pantallaLlamada.classList.add('activa');
    llamadaMinimizada = false;
  }
}

function alternarSilenciar() {
  if (!streamLocal) return;
  silenciado = !silenciado;
  streamLocal.getAudioTracks().forEach(track => track.enabled = !silenciado);
  actualizarBotonesLlamada();
}

function alternarAltavoz() {
  altavozActivo = !altavozActivo;
  actualizarBotonesLlamada();
}

function alternarCamara() {
  if (!streamLocal) return;
  camaraActiva = !camaraActiva;
  const videoTrack = streamLocal.getVideoTracks()[0];
  if (videoTrack) videoTrack.enabled = camaraActiva;
  actualizarBotonesLlamada();
}

function actualizarBotonesLlamada() {
  const iconoSilenciar = document.getElementById('icono-mudo-barra');
  if (iconoSilenciar) iconoSilenciar.style.fill = silenciado ? '#facc15' : '#fff';
  
  const todosSilenciar = [btnSilenciarBarra, btnSilenciarLlamada];
  todosSilenciar.forEach(btn => {
    if (btn) btn.style.background = silenciado ? 'rgba(239,68,68,0.5)' : '';
  });
}

function iniciarTemporizador() {
  segundosLlamada = 0;
  actualizarTiempoLlamada();
  temporizadorLlamada = setInterval(() => {
    segundosLlamada++;
    actualizarTiempoLlamada();
  }, 1000);
}

function detenerTemporizador() {
  clearInterval(temporizadorLlamada);
  temporizadorLlamada = null;
  segundosLlamada = 0;
  tiempoLlamadaBarra.textContent = '00:00';
  tiempoLlamadaGrande.textContent = '00:00';
}

function actualizarTiempoLlamada() {
  const m = Math.floor(segundosLlamada / 60).toString().padStart(2, '0');
  const s = (segundosLlamada % 60).toString().padStart(2, '0');
  tiempoLlamadaBarra.textContent = `${m}:${s}`;
  tiempoLlamadaGrande.textContent = `${m}:${s}`;
}

function registrarLlamada(numero, tipo) {
  const nuevaLlamada = {
    numero,
    nombre: contactos[numero]?.nombre || numero,
    tipo,
    fecha: new Date().toLocaleString()
  };
  
  historialLlamadas.unshift(nuevaLlamada);
  if (historialLlamadas.length > 100) historialLlamadas = historialLlamadas.slice(0, 100);
  
  localStorage.setItem('codex_llamadas', JSON.stringify(historialLlamadas));
  console.log('📝 Llamada guardada:', nuevaLlamada);
  renderizarLlamadas();
}

// ---------- RENDERIZADO ----------
function renderizarContactos() {
  listaContactos.innerHTML = '';
  const numeros = Object.keys(contactos);
  
  if (numeros.length === 0) {
    listaContactos.innerHTML = '<p class="texto-vacio">No tienes contactos aún.<br>Agrega uno arriba ↑</p>';
    return;
  }
  
  numeros.forEach(num => {
    const c = contactos[num];
    const div = document.createElement('div');
    div.className = 'item-contacto';
    div.innerHTML = `
      <div class="nombre-contacto">${c.nombrePersonal || c.nombre || num}</div>
      <div class="info-mensaje">${c.conectado ? '🟢 En línea' : '⚪ Desconectado'}</div>
    `;
    div.onclick = () => abrirChat(num);
    agregarEventoPulsar(div, () => {
      chatPulsado = num;
      mostrarMenuEliminar();
    });
    listaContactos.appendChild(div);
  });
}

function renderizarChats() {
  listaChats.innerHTML = '';
  const numeros = Object.keys(conversaciones);
  
  if (numeros.length === 0) {
    sinChats.classList.remove('oculto');
    return;
  }
  sinChats.classList.add('oculto');
  
  numeros.forEach(num => {
    const mensajes = conversaciones[num];
    const ultimo = mensajes[mensajes.length - 1];
    const sinLeer = mensajes.filter(m => 
      !m.propio && (!mensajes.ultimaLeida || new Date(m.hora) > new Date(mensajes.ultimaLeida))
    ).length;
    
    const div = document.createElement('div');
    div.className = 'item-chat';
    div.innerHTML = `
      <div class="nombre-contacto">${contactos[num]?.nombrePersonal || contactos[num]?.nombre || num}</div>
      <div class="info-mensaje">${ultimo.texto.substring(0, 25)}${ultimo.texto.length > 25 ? '...' : ''} · ${ultimo.hora}</div>
      ${sinLeer > 0 ? '<div class="punto-sin-leer"></div>' : ''}
    `;
    div.onclick = () => abrirChat(num);
    agregarEventoPulsar(div, () => {
      chatPulsado = num;
      mostrarMenuEliminar();
    });
    listaChats.appendChild(div);
  });
  
  actualizarContadorSinLeer();
}

function renderizarLlamadas() {
  listaLlamadas.innerHTML = '';
  
  if (historialLlamadas.length === 0) {
    sinLlamadas.classList.remove('oculto');
    return;
  }
  sinLlamadas.classList.add('oculto');
  
  historialLlamadas.forEach(llamada => {
    const div = document.createElement('div');
    div.className = `item-llamada ${llamada.tipo === 'entrante' ? 'llamada-entrante' : 'llamada-saliente'}`;
    div.innerHTML = `
      <div class="nombre-contacto">${llamada.nombre}</div>
      <div class="info-mensaje">${llamada.tipo === 'entrante' ? '📥 Recibida' : '📤 Realizada'} · ${llamada.fecha}</div>
    `;
    listaLlamadas.appendChild(div);
  });
}

function actualizarContadorSinLeer() {
  let total = 0;
  Object.entries(conversaciones).forEach(([num, mensajes]) => {
    total += mensajes.filter(m => 
      !m.propio && (!mensajes.ultimaLeida || new Date(m.hora) > new Date(mensajes.ultimaLeida))
    ).length;
  });
  
  const contador = contadorGlobalSinLeer;
  if (total > 0) {
    contador.style.display = 'flex';
    contador.textContent = total > 9 ? '9+' : total;
  } else {
    contador.style.display = 'none';
  }
}

// ---------- ELIMINAR CHAT AL MANTENER PULSADO ----------
function agregarEventoPulsar(elemento, callback) {
  elemento.addEventListener('touchstart', () => {
    temporizadorPulsar = setTimeout(callback, 600);
  });
  elemento.addEventListener('touchend', () => clearTimeout(temporizadorPulsar));
  elemento.addEventListener('touchmove', () => clearTimeout(temporizadorPulsar));
  elemento.addEventListener('mousedown', () => {
    temporizadorPulsar = setTimeout(callback, 600);
  });
  elemento.addEventListener('mouseup', () => clearTimeout(temporizadorPulsar));
  elemento.addEventListener('mouseleave', () => clearTimeout(temporizadorPulsar));
}

function mostrarMenuEliminar() {
  menuEliminarChat.classList.remove('oculto');
  setTimeout(() => {
    document.addEventListener('click', cerrarMenuEliminar, { once: true });
  }, 10);
}

function cerrarMenuEliminar() {
  menuEliminarChat.classList.add('oculto');
  chatPulsado = null;
}

// ---------- PERFIL DE USUARIO ----------
function abrirPerfil(numero) {
  numeroPerfil.textContent = numero;
  inicialPerfil.textContent = (contactos[numero]?.nombrePersonal || contactos[numero]?.nombre || numero).charAt(0).toUpperCase();
  nombrePerfil.value = contactos[numero]?.nombrePersonal || contactos[numero]?.nombre || numero;
  
  if (contactos[numero]?.conectado) {
    puntoEstado.classList.add('conectado');
    textoEstado.textContent = 'En línea';
  } else {
    puntoEstado.classList.remove('conectado');
    textoEstado.textContent = contactos[numero]?.ultimaVisto || 'Desconectado';
  }
  
  perfilUsuarioModal.classList.remove('oculto');
}

function guardarNombreContacto() {
  if (contactoActual) {
    if (!contactos[contactoActual]) contactos[contactoActual] = { nombre: contactoActual };
    contactos[contactoActual].nombrePersonal = nombrePerfil.value.trim() || contactoActual;
    guardarContactos();
    renderizarContactos();
    renderizarChats();
    textoNombreChat.textContent = contactos[contactoActual].nombrePersonal;
  }
  perfilUsuarioModal.classList.add('oculto');
}

// ---------- VISOR DE IMAGEN/VIDEO ----------
function abrirVisor(src, tipo) {
  const visor = document.getElementById('visorCompleto');
  const contenidoVisor = document.getElementById('contenidoVisor');
  contenidoVisor.innerHTML = tipo === 'imagen' 
    ? `<img src="${src}">` 
    : `<video src="${src}" controls autoplay></video>`;
  visor.classList.remove('oculto');
}

// ---------- GUARDADO LOCAL - CORREGIDO ----------
function guardarConversaciones() {
  try {
    localStorage.setItem('codex_chats', JSON.stringify(conversaciones));
    console.log('💬 Conversaciones guardadas:', Object.keys(conversaciones).length);
  } catch (e) {
    console.error('❌ Error guardando conversaciones:', e);
  }
}

function guardarContactos() {
  try {
    localStorage.setItem('codex_contactos', JSON.stringify(contactos));
    console.log('👤 Contactos guardados:', Object.keys(contactos).length);
  } catch (e) {
    console.error('❌ Error guardando contactos:', e);
  }
}

// ---------- EVENTOS ----------
function configurarEventos() {
  // Conectar
  btnConectar.onclick = () => {
    miNumero = miNumeroInput.value.trim();
    if (miNumero) conectarPeer();
  };
  
  // Menú pestañas
  itemsMenu.forEach(boton => {
    boton.onclick = () => {
      itemsMenu.forEach(b => b.classList.remove('activa'));
      boton.classList.add('activa');
      const pestana = boton.dataset.pestana;
      vistas.forEach(v => v.classList.remove('activa'));
      document.getElementById(`vista-${pestana}`).classList.add('activa');
    };
  });
  
  // Agregar usuario
  btnAgregarUsuario.onclick = () => {
    const num = numeroDestinoInput.value.trim();
    if (!num) return;
    if (!contactos[num]) contactos[num] = { nombre: num };
    guardarContactos();
    renderizarContactos();
    numeroDestinoInput.value = '';
    abrirChat(num);
  };
  
  // Chat
  btnVolver.onclick = cerrarChat;
  btnVerPerfil.onclick = () => contactoActual && abrirPerfil(contactoActual);
  btnLlamar.onclick = mostrarMenuTipoLlamada; // ⚠️ Ahora muestra menú antes de llamar
  btnEnviar.onclick = () => {
    if (inputMensaje.value.trim()) {
      enviarMensaje(inputMensaje.value.trim());
    }
  };
  inputMensaje.onkeydown = (e) => {
    if (e.key === 'Enter' && inputMensaje.value.trim()) {
      enviarMensaje(inputMensaje.value.trim());
    }
  };
  
  // Opciones adjuntar
  btnOpciones.onclick = () => menuOpciones.classList.toggle('mostrar');
  document.querySelectorAll('.opcion-envio').forEach(opcion => {
    opcion.onclick = () => {
      const tipo = opcion.dataset.tipo;
      if (tipo === 'imagen') inputImagen.click();
      else if (tipo === 'video') inputVideo.click();
      else if (tipo === 'audio') alert('Grabación de audio próximamente');
      menuOpciones.classList.remove('mostrar');
    };
  });
  
  inputImagen.onchange = (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = (evento) => {
      enviarMensaje(evento.target.result, 'imagen');
    };
    lector.readAsDataURL(archivo);
    inputImagen.value = '';
  };
  
  inputVideo.onchange = (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = (evento) => {
      enviarMensaje(evento.target.result, 'video');
    };
    lector.readAsDataURL(archivo);
    inputVideo.value = '';
  };
  
  // Llamadas
  btnColgarBarra.onclick = finalizarLlamada;
  btnColgarPantalla.onclick = finalizarLlamada;
  btnRechazar.onclick = rechazarLlamada;
  btnResponder.onclick = responderLlamada;
  btnMinimizarLlamada.onclick = minimizarLlamada;
  btnMinimizarPantallaLlamada.onclick = minimizarLlamada;
  barraLlamadaActiva.onclick = () => {
    if (llamadaActiva || llamadaEntrante) maximizarLlamada();
  };
  btnSilenciarBarra.onclick = alternarSilenciar;
  btnSilenciarLlamada.onclick = alternarSilenciar;
  btnAltavozLlamada.onclick = alternarAltavoz;
  btnCamaraLlamada.onclick = alternarCamara;
  btnChatDesdeLlamada.onclick = () => {
    minimizarLlamada();
    if (contactoActual) abrirChat(contactoActual);
  };
  
  // Eliminar chat
  opcionEliminarChat.onclick = () => {
    if (chatPulsado) eliminarConversacion(chatPulsado);
  };
  
  // Perfil
  btnCerrarPerfil.onclick = () => perfilUsuarioModal.classList.add('oculto');
  btnGuardarPerfil.onclick = guardarNombreContacto;
  perfilUsuarioModal.onclick = (e) => {
    if (e.target === perfilUsuarioModal) perfilUsuarioModal.classList.add('oculto');
  };
  
  // Visor
  document.getElementById('btnCerrarVisor').onclick = () => {
    document.getElementById('visorCompleto').classList.add('oculto');
  };
  document.getElementById('visorCompleto').onclick = (e) => {
    if (e.target.id === 'visorCompleto') {
      document.getElementById('visorCompleto').classList.add('oculto');
    }
  };
  
  // Cerrar menú opciones al tocar fuera
  document.addEventListener('click', (e) => {
    if (!btnOpciones.contains(e.target) && !menuOpciones.contains(e.target)) {
      menuOpciones.classList.remove('mostrar');
    }
  });
}

// Iniciar todo 🚀
init();
console.log('✅ CODEx cargado correctamente');
