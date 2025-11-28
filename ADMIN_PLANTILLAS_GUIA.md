# Guía de Administración de Plantillas de Cierre

Esta guía explica cómo usar la interfaz de administración de plantillas de cierre para configurar campos con cantidad y porcentaje.

## 📍 Acceso

La interfaz de administración está en:
```
/admin/editar-plantilla/[id]
```

## ✨ Características Implementadas

### 1. **CRUD Completo**
- ✅ Crear/editar/eliminar secciones
- ✅ Crear/editar/eliminar campos
- ✅ Reordenar secciones y campos
- ✅ Activar/desactivar plantillas

### 2. **Editor de Opciones para Select/Multiselect**
Ahora puedes configurar campos de tipo `select` o `multiselect` con:
- **Value**: Identificador único de la opción
- **Label**: Texto que ve el usuario
- **Cantidad**: Checkbox para activar campo de cantidad
- **Porcentaje**: Checkbox para activar campo de porcentaje
- **Etiquetas personalizadas**: Para los campos de cantidad/porcentaje

### 3. **Campos Adicionales**
- **Placeholder**: Texto de ayuda en el campo
- **Unidad**: Para campos numéricos (hectáreas, km/h, °C, etc.)
- **Descripción**: Texto explicativo del campo
- **Campo requerido**: Marcar si es obligatorio

## 🎯 Cómo Agregar un Campo con Cantidad/Porcentaje

### Paso 1: Crear/Editar un Campo
1. Navega a la plantilla que quieres editar
2. Expande la sección donde quieres agregar el campo
3. Toca el botón **+** junto a "Campos"

### Paso 2: Configurar el Campo Básico
1. **Nombre**: "Medios terrestres"
2. **Descripción**: "Vehículos y equipos utilizados"
3. **Tipo**: Selecciona **"Selección múltiple"** (multiselect)
4. **Orden**: Se asigna automáticamente
5. **Campo requerido**: Activa si es obligatorio

### Paso 3: Agregar Opciones con Cantidad
Cuando seleccionas tipo "select" o "multiselect", aparece el editor de opciones:

1. Toca **"Agregar"** para crear una opción
2. Completa:
   - **Value**: `camion_cisterna` (sin espacios, identificador único)
   - **Label**: `Camión cisterna` (texto visible para el usuario)
3. Activa **"Requiere cantidad"**
4. Escribe la etiqueta: `Número de camiones`
5. Toca **"Agregar"**

Repite para cada opción:
- Pick-up → "Cantidad de pick-ups"
- Motocicleta → "Cantidad de motocicletas"
- Brigada a pie → "Número de brigadistas"

### Paso 4: Opciones con Porcentaje
Para campos como "Tipo de incendio":

1. **Value**: `rastrero`
2. **Label**: `Rastrero (fuego superficial)`
3. Activa **"Requiere porcentaje"**
4. Etiqueta: `% del área afectada`

### Paso 5: Guardar
Toca **"Actualizar"** o **"Crear"** para guardar el campo.

## 📊 Ejemplo Completo: Medios Terrestres

```
┌─────────────────────────────────────────┐
│ Nombre: Medios terrestres               │
│ Tipo: Selección múltiple                │
│ Requerido: ☑                            │
│                                          │
│ Opciones:                                │
│ ┌───────────────────────────────────┐   │
│ │ 1. Pick-up                        │   │
│ │    ☑ Requiere cantidad            │   │
│ │    "Cantidad de pick-ups"         │   │
│ ├───────────────────────────────────┤   │
│ │ 2. Camión                         │   │
│ │    ☑ Requiere cantidad            │   │
│ │    "Cantidad de camiones"         │   │
│ ├───────────────────────────────────┤   │
│ │ 3. Motobomba                      │   │
│ │    ☑ Requiere cantidad            │   │
│ │    "Cantidad de motobombas"       │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## 🔧 Editor de Opciones - Funciones

### Agregar Opción
1. Toca **"Agregar"** en la parte superior del editor
2. Completa el formulario en la parte inferior
3. Toca **"Agregar"** o **"Actualizar"**

### Editar Opción
1. Toca el ícono de **lápiz** en la opción
2. Modifica los valores en el formulario
3. Toca **"Actualizar"**

### Eliminar Opción
1. Toca el ícono de **basura** en la opción
2. Confirma la eliminación

### Reordenar Opciones
- Usa las flechas **↑** y **↓** para cambiar el orden
- El orden se muestra con el número en el chip azul

## 💡 Casos de Uso

### 1. Medios de Transporte (con cantidad)
```
Tipo: multiselect
Opciones:
  - Camión cisterna → Cantidad
  - Helicóptero → Cantidad
  - Motocicleta → Cantidad
```

### 2. Tipo de Vegetación (con porcentaje)
```
Tipo: multiselect
Opciones:
  - Bosque de coníferas → % del área total
  - Pastizal → % del área total
  - Cultivos → % del área total
```

### 3. Tipo de Incendio (con porcentaje)
```
Tipo: multiselect
Opciones:
  - Rastrero → % del área
  - De copas → % del área
  - Subterráneo → % del área
```

### 4. Mixto (opciones con y sin campos adicionales)
```
Tipo: multiselect
Opciones:
  - CONRED (sin campos adicionales)
  - Bomberos → Cantidad
  - Ejercito → Cantidad
  - Comunidad local (sin campos adicionales)
```

## 📱 Vista en el Formulario de Cierre

Cuando un usuario llena el formulario de cierre, verá:

```
☐ Pick-up
☑ Camión          [Cantidad: 5    ]
☑ Motobomba       [Cantidad: 3    ]
☐ Cisterna
```

O para porcentajes:

```
☑ Rastrero        [% del área: 60 ]
☑ De copas        [% del área: 40 ]
☐ Subterráneo
```

## ⚠️ Validaciones

El sistema valida automáticamente:
- ✅ Value único (no puede haber duplicados)
- ✅ Value y Label son requeridos
- ✅ Select/multiselect deben tener al menos 1 opción
- ✅ Los valores numéricos deben ser números válidos

## 🔍 Información Visual

En la lista de campos, verás indicadores visuales:
- 📊 **"X opciones"**: Cantidad de opciones configuradas
- 🔢 **"Con cantidad"**: Al menos una opción requiere cantidad
- 📈 **"Con porcentaje"**: Al menos una opción requiere porcentaje

## 🚀 Tips y Buenas Prácticas

### Values
- Usa snake_case: `camion_cisterna`, `bosque_coniferas`
- Sin espacios ni caracteres especiales
- Cortos pero descriptivos

### Labels
- Texto claro y legible para el usuario
- Usa mayúsculas y acentos correctamente
- Puedes incluir aclaraciones: "Helicóptero (con helibalde)"

### Etiquetas de Cantidad/Porcentaje
- Sé específico: "Número de camiones" vs "Cantidad"
- Usa el contexto: "% del área afectada" vs "Porcentaje"
- Mantén consistencia en la plantilla

### Orden
- Ordena alfabéticamente o por frecuencia de uso
- Los más comunes primero
- Agrupa opciones relacionadas

## 🛠️ Solución de Problemas

### "No aparece el editor de opciones"
- Verifica que el tipo sea "Selección única" o "Selección múltiple"
- El editor aparece automáticamente al seleccionar estos tipos

### "Error al guardar"
- Verifica que todas las opciones tengan value y label
- Asegúrate de que no haya values duplicados
- Los campos select/multiselect deben tener al menos 1 opción

### "Los cambios no se reflejan en el formulario"
- Refresca la lista de plantillas
- Verifica que la plantilla esté activa
- Cierra y vuelve a abrir el formulario de cierre

## 📚 Archivos Relacionados

- **Editor principal**: `app/admin/editar-plantilla/[id].tsx`
- **Editor de opciones**: `components/CampoOpcionesEditor.tsx`
- **Formulario de cierre**: `components/FormularioCierre.tsx`
- **Servicio backend**: `services/plantillasCierre.ts`

## ✅ Checklist para Agregar un Campo

- [ ] Crear/editar el campo
- [ ] Configurar tipo (select o multiselect)
- [ ] Agregar todas las opciones necesarias
- [ ] Activar "Requiere cantidad" o "Requiere porcentaje" según corresponda
- [ ] Escribir etiquetas descriptivas para los campos adicionales
- [ ] Verificar el orden de las opciones
- [ ] Probar en el formulario de cierre
- [ ] Verificar que los datos se guarden correctamente
