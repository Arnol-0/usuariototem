# Implementación del Inicio de Sesión por Número de Tótem

El objetivo es permitir a un operador iniciar sesión simplemente ingresando el número o código de tótem/puesto, como por ejemplo `a-1`, simulando o saltando el ingreso clásico de usuario (correo) y contraseña. De este modo, al teclear `a-1`, se iniciará automáticamente la sesión para el usuario con la letra `A` asignada y bajo el identificador `1`.

## Revisión Requerida del Usuario

> [!IMPORTANT]
> Necesito que me aclares estos puntos vitales sobre cómo debe funcionar esto con tu base de datos y la lógica de Firebase:
> 
> 1. **¿Deseas reemplazar completamente la interfaz actual (Usuario/Correo y Contraseña) por un solo campo para ingresar el "número de tótem", o deberíamos tener ambas opciones?**
> 2. **Al ingresar "a-1" (sin contraseña), ¿la aplicación debería simplemente entrar como un usuario genérico de la letra "A" y estación "1", o el ID "a-1" se validará contra tu base de datos en la colección `operators` o `stations`?**
> 3. Si entra directo sin validar contraseña, este usuario virtual no tendrá el `email` ni permisos administrativos (admin), ¿esto es correcto? Solo se asignará como `operator` con la letra que escriba.

## Cambios Propuestos

### [src/components/Login.tsx](file:///c:/Users/Arnol/Desktop/usuariototem/src/components/Login.tsx)
- **[MODIFY] src/components/Login.tsx**
  - Ocultar o remover los campos de usuario y contraseña y mostrar un solo campo "Número de Tótem" (ejemplo: `a-1`).
  - Al hacer submit, separar la letra (A) y enviar el nuevo método de login directamente mediante el callback `onLogin`, sin hacer consulta a la base de datos para buscar usuario/clave.

### [src/App.tsx](file:///c:/Users/Arnol/Desktop/usuariototem/src/App.tsx) y [src/services/totemService.ts](file:///c:/Users/Arnol/Desktop/usuariototem/src/services/totemService.ts)
- **[MODIFY] src/App.tsx**
  - Modificar cómo [handleLogin](file:///c:/Users/Arnol/Desktop/usuariototem/src/App.tsx#83-93) procesa al usuario cuando la sesión es por número de tótem.
- **[MODIFY] src/services/totemService.ts**
  - Modificar localmente [setOperatorName](file:///c:/Users/Arnol/Desktop/usuariototem/src/services/totemService.ts#134-179) para que, en caso de no encontrarse un operador real o estación en la base de datos (por ejemplo, si ingresan algo que no está), cree un puesto "virtual" con los `labels` asociados (por ej: `['A']`) para que el puente (rtbdBridge) de Firebase empiece a buscar tickets con la letra `A`.

## Plan de Verificación

### Verificación Manual
1. Iniciar la aplicación (`npm run dev`).
2. En la pantalla de inicio de sesión, ingresar `a-1`.
3. Validar que la sesión inicie instantáneamente (sin pedir error de password) con el puesto "A-1".
4. Revisar que la interfaz principal empiece a consultar y atender turnos con la letra `A`.
