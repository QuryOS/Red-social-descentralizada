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
const pantallaPrincipal = document.getElementById('pantallaPrincipal');
const pantallaChat = document.getElementById('pantallaChat');
const nombreChat = document.getElementById('nombreChat');
const cajaMensajes = document.getElementById('cajaMensajes');
const btnVolver = document.getElementById('btnVolver');
const inputMensaje = document.getElementById('inputMensaje');
const btnEnviar = document.getElementById('btnEnviar');

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let baseDatos = null;
let contactos = {};
let chatActivo = null;
let miNumero = '';

// ==========================================
// BASE DE DATOS
// ==========================================
function abrirBaseDatos() {
  return new Promise((res, rej) => {
    const solicitud = indexedDB.open('CodexDB_Final', 1);
    
    solicitud.onupgradeneeded = e => {
      baseDatos = e.target.result;
      
      // Tabla para el perfil del usuario
      if (!baseDatos.objectStoreNames.contains('perfil')) {
        baseDatos.createObjectStore('perfil');
      }
      
      // Tabla para los mensajes
      if (!baseDatos.objectStoreNames.contains('mensajes')) {
        const mensajesStore = baseDatos.createObjectStore('mensajes', { autoIncrement: true });
        mensajesStore.createIndex('conQuien', 'conQuien', { unique: false });
      }
    };
    
    solicitud.onsuccess = e => {
      baseDatos = e.target.result;
      res();
    };
    
    solicitud.onerror = e => {
      rej('Error al abrir la base de datos');
    };
  });
}

async function guardarPerfil(clave, valor) {
  return new Promise((res, rej) => {
    const transaccion = baseDatos.transaction('perfil', 'readwrite');
    transaccion.objectStore('perfil').put(valor, clave);
    transaccion.oncomplete = () => res();
    transaccion.onerror = () => rej('Error guardando perfil');
  });
}

async function leerPerfil(clave) {
  return new Promise((res, rej) => {
    const transaccion = baseDatos.transaction('perfil', 'readonly');
    const solicitud = transaccion.objectStore('perfil').get(clave);
    solicitud.onsuccess = () => res(solicitud.result);
    solicitud.onerror = () => rej('Error leyendo perfil');
  });
}

async function guardarMensaje(conQuien, texto, esMio) {
  return new Promise((res, rej) => {
    const transaccion = baseDatos.transaction('mensajes', 'readwrite');
    const mensaje = {
      conQuien: conQuien,
      texto: texto,
      esMio: esMio,
      fecha: new Date().toLocaleString()
    };
    
    transaccion.objectStore('mensajes').add(mensaje);
    
    transaccion.oncomplete = () => {
      // Actualizar en memoria
      if (!contactos[conQuien]) {
        contactos[conQuien] = { mensajes: [], ultimoMensaje: '' };
      }
      contactos[conQuien].mensajes.push(mensaje);
      contactos[conQuien].ultimoMensaje = texto;
      res();
    };
    
    transaccion.onerror = () => rej('Error guardando mensaje');
  });
}

async function cargarTodosLosMensajes() {
  return new Promise((res, rej) => {
    const transaccion = baseDatos.transaction('mensajes', 'readonly');
    const todos = transaccion.objectStore('mensajes').getAll();
    
    todos.onsuccess = () => {
      const mensajes = todos.result;
      contactos = {};
      
      mensajes.forEach(msg => {
        if (!contactos[msg.conQuien]) {
          contactos[msg.conQuien] = { mensajes: [], ultimoMensaje: '' };
        }
        contactos[msg.conQuien].mensajes.push(msg);
        contactos[msg.conQuien].ultimoMensaje = msg.texto;
      });
      
      res();
    };
    
    todos.onerror = () => rej('Error cargando mensajes');
  });
}

// ==========================================
// INTERFAZ
// ==========================================
function mostrarMensajeEnChat(texto, esMio, fecha) {
  const div = document.createElement('div');
  div.style.cssText = `
    max-width: 75%; margin: 6px 0; padding: 10px 14px; border-radius: 18px;
    background: ${esMio ? '#dcf8c6' : '#ffffff'};
    align-self: ${esMio ? 'flex-end' : 'flex-start'};
    border: 1px solid #eee;
  `;
  div.innerHTML = `
    <div style="font-size: 15px;">${texto}</div>
    <div style="font-size: 11px; color: #888; text-align: right; margin-top: 4px;">${fecha}</div>
  `;
  cajaMensajes.style.display = 'flex';
  cajaMensajes.style.flexDirection = 'column';
  cajaMensajes.appendChild(div);
  cajaMensajes.scrollTop = cajaMensajes.scrollHeight;
}

function actualizarListaChats() {
  listaChats.innerHTML = '';
  const hayChats = Object.keys(contactos).length > 0;
  sinChats.classList.toggle('oculto', hayChats);
  
  if (!hayChats) return;
  
  Object.keys(contactos).forEach(numero => {
    const div = document.createElement('div');
    div.style.cssText = `
      padding: 14px; border-bottom: 1px solid #eee; cursor: pointer;
      background: white;
    `;
    div.innerHTML = `
      <div style="font-weight: 600; font-size: 16px;">${numero}</div>
      <div style="color: #666; font-size: 14px; margin-top: 2px;">${contactos[numero].ultimoMensaje}</div>
    `;
    div.addEventListener('click', () => abrirChat(numero));
    listaChats.appendChild(div);
  });
}

function abrirChat(numero) {
  chatActivo = numero;
  nombreChat.textContent = numero;
  cajaMensajes.innerHTML = '';
  
  // Mostrar todos los mensajes guardados
  if (contactos[numero] && contactos[numero].mensajes) {
    contactos[numero].mensajes.forEach(msg => {
      mostrarMensajeEnChat(msg.texto, msg.esMio, msg.fecha);
    });
  }
  
  pantallaPrincipal.classList.remove('activa');
  pantallaChat.classList.add('activa');
  document.body.classList.add('con-chat-abierto');
}

btnVolver.addEventListener('click', () => {
  pantallaChat.classList.remove('activa');
  pantallaPrincipal.classList.add('activa');
  document.body.classList.remove('con-chat-abierto');
  chatActivo = null;
});

async function enviarMensaje() {
  const texto = inputMensaje.value.trim();
  if (!texto || !chatActivo) return;
  
  const fecha = new Date().toLocaleString();
  mostrarMensajeEnChat(texto, true, fecha);
  
  try {
    await guardarMensaje(chatActivo, texto, true);
  } catch(err) {
    alert('Error al guardar: ' + err);
  }
  
  inputMensaje.value = '';
  actualizarListaChats();
}

btnEnviar.addEventListener('click', enviarMensaje);

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
  numeroDestinoInput.value = '';
});

btnConectar.addEventListener('click', async () => {
  const numero = miNumeroInput.value.trim();
  if (!numero) {
    alert('Escribe tu número');
    return;
  }
  miNumero = numero;
  await guardarPerfil('miNumero', numero);
  estadoConexion.textContent = 'Conectado: ' + numero;
  alert('¡Listo! Tus mensajes se guardarán en tu teléfono');
});

// ==========================================
// INICIO
// ==========================================
async function iniciar() {
  try {
    await abrirBaseDatos();
    
    const numeroGuardado = await leerPerfil('miNumero');
    if (numeroGuardado) {
      miNumero = numeroGuardado;
      miNumeroInput.value = numeroGuardado;
      estadoConexion.textContent = 'Conectado: ' + numeroGuardado;
    }
    
    await cargarTodosLosMensajes();
    actualizarListaChats();
    
  } catch(err) {
    alert('Error: ' + err);
  }
}

iniciar();
