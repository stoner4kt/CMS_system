---
name: OpenAPI codegen naming
description: Orval can emit duplicate Zod exports when operation parameters create a generated Params type.
---

When adding an OpenAPI operation, prefer an operationId that does not collide with a generated schema/type name. Query parameters can cause Orval's Zod output to export the operation Params symbol from both generated/api and generated/types.

**Why:** The workspace re-exports both generated modules, so a collision fails the library typecheck after codegen.

**How to apply:** After every OpenAPI change, run codegen and the library typecheck; if a duplicate export appears, rename the operationId or adjust the contract before continuing.