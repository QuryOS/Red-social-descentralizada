// ==========================================
// ELEMENTOS DEL HTML
// ==========================================
const miNumeroInput = document.getElementById('miNumero');
const btnConectar = document.getElementById('btnConectar');
const estadoConexion = document.getElementById('estadoConexion');
const numeroDestinoInput = document.getElementById('numeroDestino');
const btnAgregarUsuario = document.getElementById('btnAgregarUsuario');
const listaContactos = document.getElementById('listaContactos');
const listaChats = document.getElementById('listaChats');
const sinChats = document.getElementById('sinChats');
const sinLlamadas = document.getElementById('sinLlamadas');
const contadorGlobalSinLeer = document.getElementById('contadorGlobalSinLeer');

const pantallaPrincipal = document.getElementById('pantallaPrincipal');
const pantallaChat = document.getElementById('pantallaChat');
const nombreChat = document.getElementById('nombreChat');
const cajaMensajes = document.getElementById('cajaMensajes');
const btnVolver = document.getElementById('btnVolver');
const btnOpciones = document.getElementById('btnOpciones');
const menuOpciones = document.getElementById('menuOpciones');
const inputMensaje = document.getElementById('inputMensaje');
const btnEnviar = document.getElementById('btnEnviar');
const inputImagen = document.getElementById('inputImagen');
const inputVideo = document.getElementById('inputVideo');
const opcionesEnvio = document.querySelectorAll('.opcion-envio');

const visorCompleto = document.getElementById('visorCompleto');
const contenidoVisor = document.getElementById('contenidoVisor');
const btnCerrarVisor = document.getElementById('btnCerrarVisor');

const itemsMenu = document.querySelectorAll('.item-menu');
const vistas = document.querySelectorAll('.vista-pestana');

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let baseDatos = null;
let contactos = {};
let chatActivo = null;
let miNumero = '';

// ==========================================
// BASE DE DATOS — IndexedDB
// ==========================================
function abrirBaseDatos() {
  return new Promise((res, rej) => {
    const solicitud = indexedDB.open('CodexDB_Mensajes', 1);
    
    solicitud.onupgradeneeded = e => {
      baseDatos = e.target.result;
      
      if (!baseDatos.objectStoreNames.contains('perfil')) {
        baseDatos.createObjectStore('perfil');
      }
      
      if (!baseDatos.objectStoreNames.contains('mensajes')) {
        const store = baseDatos.createObjectStore('mensajes', { autoIncrement: true });
        store.createIndex('conQuien', 'conQuien', { unique: false });
      }
    };
    
    solicitud.onsuccess = e => {
      baseDatos = e.target.result;
      res();
    };
    
    solicitud.onerror = e => {
      alert('❌ No se pudo abrir la base de datos');
      rej(e.target.error);
    };
  });
}

async function guardarPerfil(clave, valor) {
  return new Promise((res, rej) => {
    const tx = baseDatos.transaction('perfil', 'readwrite');
    tx.objectStore('perfil').put(valor, clave);
    tx.oncomplete = () => res();
    tx.onerror = e => rej(e.target.error);
  });
}

async function leerPerfil(clave) {
  return new Promise((res, rej) => {
    const tx = baseDatos.transaction('perfil', 'readonly');
    const solicitud = tx.objectStore('perfil').get(clave);
    solicitud.onsuccess = () => res(solicitud.result || null);
    solicitud.onerror = e => rej(e.target.error);
  });
}

async function guardarMensaje(conQuien, texto, esMio, tipo = 'texto', datosArchivo = '') {
  return new Promise((res, rej) => {
    const tx = baseDatos.transaction('mensajes', 'readwrite');
    const mensaje = {
      conQuien: conQuien,
      texto: texto,
      tipo: tipo,
      datosArchivo: datosArchivo,
      esMio: esMio,
      fecha: new Date().toLocaleString()
    };
    
    tx.objectStore('mensajes').add(mensaje);
    
    tx.oncomplete = () => {
      if (!contactos[conQuien]) {
        contactos[conQuien] = { mensajes: [], ultimoMensaje: '' };
      }
      contactos[conQuien].mensajes.push(mensaje);
      contactos[conQuien].ultimoMensaje = tipo === 'imagen' ? '[Imagen]' : 
                                          tipo === 'video' ? '[Video]' : texto;
      res();
    };
    
    tx.onerror = () => {
      alert('❌ No se pudo guardar el mensaje');
      rej(tx.error);
    };
  });
}

async function cargarTodosLosMensajes() {
  return new Promise((res, rej) => {
    if (!baseDatos) {
      alert('❌ Base de datos no disponible');
      return res({});
    }
    
    const tx = baseDatos.transaction('mensajes', 'readonly');
    const todos = tx.objectStore('mensajes').getAll();
    
    todos.onsuccess = () => {
      const lista = todos.result;
      contactos = {};
      
      lista.forEach(msg => {
        if (!msg.conQuien) return;
        if (!contactos[msg.conQuien]) {
          contactos[msg.conQuien] = { mensajes: [], ultimoMensaje: '' };
        }
        contactos[msg.conQuien].mensajes.push(msg);
        contactos[msg.conQuien].ultimoMensaje = msg.tipo === 'imagen' ? '[Imagen]' : 
                                                  msg.tipo === 'video' ? '[Video]' : msg.texto;
      });
      
      alert(`✅ Cargados ${lista.length} mensajes guardados`);
      res();
    };
    
    todos.onerror = () => {
      alert('❌ No se pudieron leer los mensajes');
      rej(todos.error);
    };
  });
}

// ==========================================
// RENDERIZAR MENSAJE EN PANTALLA
// ==========================================
function mostrarMensajeEnChat(msg) {
  const div = document.createElement('div');
  div.className = `mensaje ${msg.esMio ? 'propio' : 'otro'}`;
  
  if (msg.tipo === 'texto' || msg.tipo === 'mensaje') {
    div.innerHTML = `
      <p>${msg.texto || ''}</p>
      <p class="hora">${msg.fecha}</p>
    `;
  } else if (msg.tipo === 'imagen') {
    div.innerHTML = `
      <img src="${msg.datosArchivo}" onclick="abrirVisor('${msg.datosArchivo}', 'imagen')">
      <p class="hora">${msg.fecha}</p>
    `;
  } else if (msg.tipo === 'video') {
    div.innerHTML = `
      <video controls><source src="${msg.datosArchivo}"></video>
      <p class="hora">${msg.fecha}</p>
    `;
  }
  
  cajaMensajes.appendChild(div);
  cajaMensajes.scrollTop = cajaMensajes.scrollHeight;
}

// ==========================================
// LISTAS DE CHATS Y CONTACTOS
// ==========================================
function actualizarListaChats() {
  listaChats.innerHTML = '';
  const hayChats = Object.keys(contactos).length > 0;
  sinChats.classList.toggle('oculto', hayChats);
  
  if (!hayChats) return;
  
  Object.keys(contactos).forEach(numero => {
    const div = document.createElement('div');
    div.className = 'item-chat';
    div.innerHTML = `
      <div class="nombre-contacto">${numero}</div>
      <div class="info-mensaje">${contactos[numero].ultimoMensaje || 'Sin mensajes'}</div>
    `;
    div.addEventListener('click', () => abrirChat(numero));
    listaChats.appendChild(div);
  });
}

function actualizarListaContactos() {
  listaContactos.innerHTML = '';
  if (Object.keys(contactos).length === 0) {
    listaContactos.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Aún no tienes contactos</p>';
    return;
  }
  Object.keys(contactos).forEach(numero => {
    const div = document.createElement('div');
    div.className = 'item-contacto';
    div.innerHTML = `<div class="nombre-contacto">${numero}</div>`;
    div.addEventListener('click', () => abrirChat(numero));
    listaContactos.appendChild(div);
  });
}

// ==========================================
// ABRIR Y CERRAR CHAT
// ==========================================
function abrirChat(numero) {
  chatActivo = numero;
  nombreChat.textContent = numero;
  cajaMensajes.innerHTML = '';
  
  if (contactos[numero] && contactos[numero].mensajes) {
    contactos[numero].mensajes.forEach(msg => mostrarMensajeEnChat(msg));
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
  menuOpciones.classList.remove('mostrar');
  actualizarListaChats();
  actualizarListaContactos();
});

// ==========================================
// ENVIAR MENSAJE DE TEXTO
// ==========================================
async function enviarMensaje() {
  const texto = inputMensaje.value.trim();
  if (!texto || !chatActivo) return;
  
  const msg = {
    texto: texto,
    tipo: 'texto',
    esMio: true,
    fecha: new Date().toLocaleString()
  };
  
  mostrarMensajeEnChat(msg);
  
  try {
    await guardarMensaje(chatActivo, texto, true, 'texto');
    alert('✅ Mensaje guardado');
  } catch(err) {
    alert('❌ Error al guardar');
  }
  
  inputMensaje.value = '';
  actualizarListaChats();
}

btnEnviar.addEventListener('click', enviarMensaje);
inputMensaje.addEventListener('keypress', e => {
  if (e.key === 'Enter') enviarMensaje();
});

// ==========================================
// AGREGAR CONTACTO
// ==========================================
btnAgregarUsuario.addEventListener('click', () => {
  const numero = numeroDestinoInput.value.trim();
  if (!numero) {
    alert('Escribe un número');
    return;
  }
  if (!contactos[numero]) {
    contactos[numero] = { mensajes: [], ultimoMensaje: '¡Hola!' };
  }
  actualizarListaChats();
  actualizarListaContactos();
  numeroDestinoInput.value = '';
  alert('✅ Contacto agregado');
});

// ==========================================
// CONECTAR NÚMERO
// ==========================================
btnConectar.addEventListener('click', async () => {
  const numero = miNumeroInput.value.trim();
  if (!numero) {
    alert('Escribe tu número primero');
    return;
  }
  miNumero = numero;
  await guardarPerfil('miNumero', numero);
  estadoConexion.textContent = 'Conectado';
  estadoConexion.classList.add('estado-conectado');
  alert(`✅ Conectado como: ${miNumero}`);
});

// ==========================================
// MENÚ INFERIOR
// ==========================================
itemsMenu.forEach(boton => {
  boton.addEventListener('click', () => {
    const pestana = boton.dataset.pestana;
    itemsMenu.forEach(b => b.classList.remove('activa'));
    boton.classList.add('activa');
    
    vistas.forEach(vista => {
      vista.classList.toggle('activa', vista.id === `vista-${pestana}`);
    });
  });
});

// ==========================================
// OPCIONES DE ENVÍO (IMAGEN / VIDEO)
// ==========================================
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

inputImagen.addEventListener('change', async e => {
  const archivo = e.target.files[0];
  if (!archivo || !chatActivo) return;
  
  const lector = new FileReader();
  lector.onload = async function(evento) {
    const datos = evento.target.result;
    const msg = {
      tipo: 'imagen',
      datosArchivo: datos,
      esMio: true,
      fecha: new Date().toLocaleString()
    };
    mostrarMensajeEnChat(msg);
    await guardarMensaje(chatActivo, '[Imagen]', true, 'imagen', datos);
    actualizarListaChats();
  };
  lector.readAsDataURL(archivo);
  inputImagen.value = '';
});

inputVideo.addEventListener('change', async e => {
  const archivo = e.target.files[0];
  if (!archivo || !chatActivo) return;
  
  const lector = new FileReader();
  lector.onload = async function(evento) {
    const datos = evento.target.result;
    const msg = {
      tipo: 'video',
      datosArchivo: datos,
      esMio: true,
      fecha: new Date().toLocaleString()
    };
    mostrarMensajeEnChat(msg);
    await guardarMensaje(chatActivo, '[Video]', true, 'video', datos);
    actualizarListaChats();
  };
  lector.readAsDataURL(archivo);
  inputVideo.value = '';
});

// ==========================================
// VISOR DE IMÁGENES/VIDEO
// ==========================================
window.abrirVisor = function(datos, tipo) {
  visorCompleto.classList.remove('oculto');
  contenidoVisor.innerHTML = tipo === 'imagen' 
    ? `<img src="${datos}" style="max-width:100%;max-height:85vh;">`
    : `<video controls style="max-width:100%;max-height:85vh;"><source src="${datos}"></video>`;
};

btnCerrarVisor.addEventListener('click', () => {
  visorCompleto.classList.add('oculto');
  contenidoVisor.innerHTML = '';
});

// ==========================================
// INICIO DE LA APLICACIÓN
// ==========================================
async function iniciar() {
  alert('🚀 Iniciando Codex...');
  
  try {
    await abrirBaseDatos();
    
    const numeroGuardado = await leerPerfil('miNumero');
    if (numeroGuardado) {
      miNumero = numeroGuardado;
      miNumeroInput.value = numeroGuardado;
      estadoConexion.textContent = 'Conectado';
      estadoConexion.classList.add('estado-conectado');
    }
    
    await cargarTodosLosMensajes();
    actualizarListaChats();
    actualizarListaContactos();
    
    alert('✅ ¡Todo listo! Tus mensajes se guardarán en tu teléfono');
    
  } catch(err) {
    alert('❌ Error al iniciar: ' + err);
  }
}

// ¡EMPEZAR!
iniciar();
