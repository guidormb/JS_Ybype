export function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validar(nombre, edad, email) {
  if (!nombre.trim()) return "Error: nombre vacío"
  if (nombre.trim().length < 2) return "Error: nombre muy corto (mín 2 letras)"
  
  if (edad === "" || edad === null) return "Error: poné una edad"
  const edadNum = Number(edad)
  if (isNaN(edadNum)) return "Error: poné una edad"
  if (edadNum < 1 || edadNum > 120) return "Error: edad entre 1 y 120"
  
  if (!esEmailValido(email.trim())) return "Error: email no válido, ej: hola@mail.com"
  return null
}