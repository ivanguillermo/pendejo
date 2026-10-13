const ADMIN_EMAILS = ["ivanglopezp@gmail.com", "equ1strec3@gmail.com", "paulaherro.05@gmail.com"];
const URL_WEBAPP = "https://script.google.com/macros/s/AKfycbxj_BQ7zIlnh3fwnL6CsQIhdCHl682yqP3p1nnkm42TNGDeC3H4JuajgFkwnoh5vOsR/exec";
let imagenDriveUrl = ""; 
let base64ComprimidoGlobal = "";

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

// Compresor de imagen local optimizado
function comprimirImagen(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

// PASO 1: Muestra la previsualización y autocompleta el título si está vacío
async function mostrarPreviewLocal(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const inputNombre = document.getElementById('nombreImagenPersonalizado');
    if (!inputNombre.value) {
        const nombreSinExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        inputNombre.value = nombreSinExt.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    try {
        base64ComprimidoGlobal = await comprimirImagen(file);
        document.getElementById('imgPreview').src = base64ComprimidoGlobal;
        document.getElementById('previewContainer').style.display = "block";
    } catch (err) {
        console.error("Error al leer la imagen local:", err);
        alert("Error al leer la imagen local.");
    }
}

// PASO 2: Botón de envío que sube a Drive, ejecuta la IA y rellena los campos automáticamente
async function enviarSubidaYAnalisis() {
    if (!base64ComprimidoGlobal) {
        alert("Por favor selecciona una imagen primero.");
        return;
    }

    const nombrePersonalizado = document.getElementById('nombreImagenPersonalizado').value.trim() || "producto";
    const loading = document.getElementById('loading');
    
    loading.style.display = "block";
    loading.textContent = "🚀 Subiendo a Drive y consultando a la IA...";

    try {
        const response = await fetch(URL_WEBAPP, {
            method: "POST",
            redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "analizar",
                image: base64ComprimidoGlobal,
                mimeType: "image/jpeg",
                nombrePersonalizado: nombrePersonalizado
            })
        });

        const textResponse = await response.text();
        
        // Imprimimos la respuesta cruda en la consola para depuración
        console.log("Respuesta cruda del servidor (analizar):", textResponse);

        let result;
        try {
            result = JSON.parse(textResponse);
        } catch (e) {
            console.error("El servidor no devolvió un JSON válido:", textResponse);
            throw new Error("Respuesta no válida del servidor (ver consola para detalles).");
        }

        loading.style.display = "none";

        if (result.status === "success") {
            // Rellenar automáticamente los campos con el JSON de la IA
            document.getElementById('nombre').value = result.sugerencia.nombre || "";
            document.getElementById('categoria').value = result.sugerencia.categoria || "";
            document.getElementById('categoria_secundaria').value = result.sugerencia.categoria_secundaria || "";
            document.getElementById('coleccion').value = result.sugerencia.coleccion || "";
            document.getElementById('descripcion').value = result.sugerencia.descripcion || "";
            
            // Guardar la URL del archivo subido a Drive
            imagenDriveUrl = result.imagen_drive || "";
            
            alert("✨ ¡Imagen guardada en Drive y datos precargados con éxito! Puedes editarlos o completar precio/costo/stock.");
        } else {
            alert("Error en el servidor: " + result.message);
        }

    } catch (error) {
        loading.style.display = "none";
        console.error("Detalle completo del error en fetch (analizar):", error);
        alert("Error al procesar: " + error.message);
    }
}

// PASO 3: Guardar el artículo definitivo con toda la info en la nueva fila del Sheet
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
        
        // Imprimimos la respuesta cruda para depurar si ocurre un fallo al guardar
        console.log("Respuesta cruda del servidor (guardar):", textResponse);

        let result;
        try {
            result = JSON.parse(textResponse);
        } catch (e) {
            console.error("El servidor no devolvió un JSON válido al guardar:", textResponse);
            throw new Error("Respuesta no válida al guardar (ver consola para detalles).");
        }

        if (result.status === "success") {
            alert("✅ ¡Artículo guardado correctamente en Catalogo1!");
            location.reload();
        } else {
            alert("Error al guardar: " + result.message);
        }
    } catch (error) {
        console.error("Detalle completo del error en fetch (guardar):", error);
        alert("Error de red al guardar: " + error.message);
    }
}
