---
name: deploy-flow
description: >-
  Ejecuta el flujo de deploy por Git (commit + push) para este repositorio.
  Usar cuando el usuario diga "vamos a deploy", "subamos esto", "haz deploy",
  o pida publicar cambios en remoto.
---

# Deploy Flow

Cuando el usuario pida deploy en este proyecto, interpretar como:

1. Validar cambios (`git status`, `git diff`) y confirmar que hay algo para subir.
2. Hacer build/test rápido cuando aplique (al menos `npm run build`).
3. Crear commit con mensaje claro en formato usado por el repo.
4. Push al remoto de la rama actual (`git push` o `git push -u origin <branch>` si falta upstream).
5. Reportar resultado con hash de commit y rama remota.

## Reglas

- No hacer deploy si no hay cambios.
- No usar comandos destructivos de git.
- No hacer `push --force` salvo petición explícita.
- Si falla build o tests, detener deploy y reportar error.
- Si hay hooks que modifican archivos, incluir esos cambios y completar el commit correctamente.

## Atajos de intención

- "vamos a deploy"
- "subamos esto"
- "haz deploy"
- "súbelo al repo"

Todas estas frases significan el mismo flujo: **commit + push**.
