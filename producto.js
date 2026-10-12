
const ADMIN_EMAILS = ["ivanglopezp@gmail.com", "equ1strec3@gmail.com", "paulaherro.05@gmail.com"];
const URL_WEBAPP = "https://script.google.com/macros/s/AKfycbx9QhOOrI2mmwc6xmGtmq5clQH7rhUqZSXbnF2mMonTlowhbqlEZ_ftsXSi8Ld6yvO-/exec";
let imagenDriveUrl = ""; 

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(decodeURIComponent(window.atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
    } catch(e) { return null; }
}

function handleCredentialResponse(response) {
    const payload = parseJwt(response.credential);
    if (!payload || !payload.email) return;
    
    if (ADMIN_EMAILS.includes(payload.email.toLowerCase())) {
        sessionStorage.setItem("auth", "true");
        sessionStorage.setItem("userEmail", payload.email);
        mostrarApp();
    } else {
        document.getElementById("loginError").style.display = "block";
    }
}

function mostrarApp() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContainer").style.display = "block";
}

function cerrarSesion() {
    sessionStorage.clear();
    window.location.reload();
}

window.onload = function() {
    if (sessionStorage.getItem("auth") === "true") {
        mostrarApp();
    }
};

// Convierte archivo a Base64 mediante Promesa para evitar bloqueos
function archivoABase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Ejecuta la vista previa, subida a Drive y análisis de IA al seleccionar la foto
async function ejecutarSubidaYAnalisis(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const loading = document.getElementById('loading');

    const inputNombre = document.getElementById('nombreImagenPersonalizado');
    if (!inputNombre.value) {
        const nombreSinExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        inputNombre.value = nombreSinExt.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    const nombrePersonalizado = inputNombre.value;

    try {
        const base64Data = await archivoABase64(file);
        document.getElementById('imgPreview').src = base64Data;
        document.getElementById('previewContainer').style.display = "block";

        loading.style.display = "block";

        const response = await fetch(URL_WEBAPP, {
            method: "POST",
            redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "analizar",
                image: base64Data,
                mimeType: file.type,
                nombrePersonalizado: nombrePersonalizado
            })
        });

        const textResponse = await response.text();
        let result;
        try {
            result = JSON.parse(textResponse);
        } catch (e) {
            throw new Error("Respuesta no válida del servidor: " + textResponse);
        }

        loading.style.display = "none";

        if (result.status === "success") {
            document.getElementById('nombre').value = result.sugerencia.nombre || "";
            document.getElementById('categoria').value = result.sugerencia.categoria || "";
            document.getElementById('categoria_secundaria').value = result.sugerencia.categoria_secundaria || "";
            document.getElementById('coleccion').value = result.sugerencia.coleccion || "";
            document.getElementById('descripcion').value = result.sugerencia.descripcion || "";
            
            imagenDriveUrl = result.imagen_drive || "";
            
            alert("✨ ¡Foto subida a Drive con éxito y datos precargados por la IA!");
        } else {
            alert("Error en el servidor: " + result.message);
        }

    } catch (error) {
        loading.style.display = "none";
        alert("Error al procesar: " + error.message);
    }
}

// Guardar producto definitivo vinculado al enlace de Drive ya capturado
async function guardarProductoFinal() {
    const producto = {
        nombre: document.getElementById('nombre').value,
        precio: document.getElementById('precio').value,
        costo: document.getElementById('costo').value,
        categoria: document.getElementById('categoria').value,
        categoria_secundaria: document.getElementById('categoria_secundaria').value,
        proveedor: document.getElementById('proveedor').value,
        coleccion: document.getElementById('coleccion').value,
        talla: document.getElementById('talla').value,
        stock: document.getElementById('stock').value,
        descripcion: document.getElementById('descripcion').value,
        imagen_drive: imagenDriveUrl
    };

    if (!producto.nombre) {
        alert("Por favor ingresa un nombre para el producto.");
        return;
    }

    try {
        const response = await fetch(URL_WEBAPP, {
            method: "POST",
            redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "guardar",
                producto: producto
            })
        });

        const textResponse = await response.text();
        let result;
        try {
            result = JSON.parse(textResponse);
        } catch (e) {
            throw new Error("Respuesta no válida al guardar: " + textResponse);
        }

        if (result.status === "success") {
            alert("✅ ¡Producto guardado correctamente en Catalogo1!");
            location.reload();
        } else {
            alert("Error al guardar: " + result.message);
        }
    } catch (error) {
        alert("Error de red al guardar: " + error.message);
    }
}
