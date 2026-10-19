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

let baseDatos = null;
let contactos = {};
let chatActivo = null;
let miId = '';

// 📂 INDEXEDDB
function iniciarDB() {
  return new Promise((res, rej) => {
    const solicitud = indexedDB.open('CodexDB_v4', 1);
    
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
      alert('❌ Error abriendo base de datos');
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

// ✅ GUARDAR MENSAJE
async function guardarMensaje(conQuien, mensaje) {
  if (!conQuien) {
    alert('❌ No se puede guardar: falta destinatario');
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
      alert('✅ Mensaje GUARDADO');
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
      alert('❌ Error al guardar');
      rej(e.target.error);
    };
  });
}

// ✅ CARGAR MENSAJES
async function cargarTodosLosMensajes() {
  return new Promise((res, rej) => {
    if (!baseDatos) {
      alert('❌ Base de datos no disponible');
      return res({});
    }
    
    const tx = baseDatos.transaction('mensajes', 'readonly');
    const todos = tx.objectStore('mensajes').getAll();
    
    todos.onsuccess = () => {
      const todosMensajes = todos.result;
      
      if (todosMensajes.length === 0) {
        alert('📂 No hay mensajes guardados aún');
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
      
      alert(`📂 Cargados: ${todosMensajes.length} mensajes`);
      res(mapa);
    };
    
    todos.onerror = e => {
      alert('❌ Error al leer mensajes');
      rej(e.target.error);
    };
  });
}

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

function renderizarListaChats() {
  listaChats.innerHTML = '';
  const hayChats = Object.keys(contactos).length > 0;
  sinChats.classList.toggle('oculto', hayChats);
  
  if (!hayChats) return;
  
  const ordenados = Object.entries(contactos).sort((a, b) => (b[1].ultimoTiempo || 0) - (a[1].ultimoTiempo || 0));
  
  ordenados.forEach(([numero, datos]) => {
    const div = document.createElement('div');
    div.className = 'item-chat';
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:12px;height:12px;border-radius:50%;background:#25c557;flex-shrink:0;"></div>
        <div style="flex:1;">
          <div class="nombre-contacto">${numero}</div>
          <div class="info-mensaje">${datos.ultimoMensaje || 'Sin mensajes'}</div>
        </div>
      </div>
    `;
    div.addEventListener('click', () => abrirChat(numero));
    listaChats.appendChild(div);
  });
}

function renderizarListaContactos() {
  listaContactos.innerHTML = '';
  if (Object.keys(contactos).length === 0) {
    listaContactos.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Aún no tienes contactos</p>';
    return;
  }
  Object.keys(contactos).forEach(numero => {
    const div = document.createElement('div');
    div.className = 'item-contacto';
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:12px;height:12px;border-radius:50%;background:#25c557;"></div>
        <div>
          <div class="nombre-contacto">${numero}</div>
          <div class="info-mensaje">Contacto</div>
        </div>
      </div>
    `;
    div.addEventListener('click', () => abrirChat(numero));
    listaContactos.appendChild(div);
  });
}

function abrirChat(numero) {
  chatActivo = numero;
  nombreChat.textContent = numero;
  cajaMensajes.innerHTML = '';

  if (contactos[numero]?.mensajes) {
    contactos[numero].mensajes.forEach(m => renderizarMensaje(m));
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
  renderizarListaChats();
  renderizarListaContactos();
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

  await guardarMensaje(chatActivo, mensaje);
  renderizarMensaje(mensaje);
  inputMensaje.value = '';
  renderizarListaChats();
}

btnEnviar.addEventListener('click', enviarMensaje);

btnAgregarUsuario.addEventListener('click', () => {
  const numero = numeroDestinoInput.value.trim();
  if (!numero) { alert('Escribe un número'); return; }
  if (!contactos[numero]) {
    contactos[numero] = { mensajes: [], ultimoMensaje: '', ultimoTiempo: 0, leido: true };
  }
  renderizarListaChats();
  renderizarListaContactos();
  numeroDestinoInput.value = '';
  alert('✅ Contacto agregado');
});

btnConectar.addEventListener('click', async () => {
  const numero = miNumeroInput.value.trim();
  if (!numero) { alert('Escribe tu número'); return; }
  miId = numero;
  await guardarValor('miNumero', numero);
  estadoConexion.textContent = '✅ Conectado';
  alert(`✅ Conectado como: ${miId}`);
});

// 🚀 INICIO
async function iniciar() {
  alert('🚀 Iniciando...');
  await iniciarDB();
  
  const numeroGuardado = await leerValor('miNumero');
  if (numeroGuardado) {
    miId = numeroGuardado;
    miNumeroInput.value = numeroGuardado;
    estadoConexion.textContent = `✅ ${miId}`;
  }

  contactos = await cargarTodosLosMensajes();
  renderizarListaChats();
  renderizarListaContactos();
  
  alert('✅ Todo listo');
}

iniciar();
