<!-- rtk-instructions v2 -->
# Command output

Command output here is condensed to save tokens, keeping every signal and
dropping costly noise. Treat it as the complete result: run commands
normally, and batch related commands into one call to avoid extra turns.
Truncated results state their recovery path in their own output. Re-run a
command as `rtk proxy <cmd>` only when its result is unusable: empty when
output was clearly expected, contradicting its exit code, or garbled.
<!-- /rtk-instructions -->

# Prompts

Salve todo prompt relevante em `prompts/`. Veja `prompts/CLAUDE.md` para convenção de nomes e estrutura.

# Docker

Engine roda dentro do WSL (Ubuntu), sem Docker Desktop. Se `docker` sozinho
falhar (ex.: `unknown command: docker compose`, erro de npipe), rode
prefixando com `wsl`, ex.: `wsl docker compose -f docker-compose.test.yml up -d`.
Node/npm/vitest continuam rodando no Windows normalmente — portas dos
containers WSL2 já ficam expostas em localhost do Windows.
