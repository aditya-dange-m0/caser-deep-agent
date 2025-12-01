# File Reorganization Plan - Industry-Grade Structure

## Current Structure Analysis

### Current Issues ❌
1. **Controllers and modules scattered** at `src/mastra/` root level
2. **No feature grouping** - Related files are separated
3. **Hard to navigate** - Finding all files for one feature requires searching
4. **Not scalable** - Adding new features becomes messy
5. **Inconsistent organization** - Mix of patterns

### Current Structure
```
src/mastra/
├── agents/                    # Agent definitions (good)
├── tools/                     # Tool definitions (good)
├── common/                    # Shared utilities (good)
├── services/                  # Services (partially organized)
│   ├── streaming/
│   └── *.service.ts
├── *.controller.ts           # ❌ Scattered controllers
├── *.module.ts               # ❌ Scattered modules
├── memoryStore.ts            # ❌ At root
└── index.ts
```

## Proposed Structure - Feature-Based Organization

This follows **NestJS best practices** and **industry standards** for maintainable codebases.

```
src/mastra/
├── common/                          # ✅ Shared utilities (unchanged)
│   ├── constants.ts
│   ├── types.ts
│   ├── errors.ts
│   ├── parallel-task.service.ts
│   ├── file-logger.service.ts
│   ├── stream-event-emitter.ts
│   └── index.ts
│
├── agents/                          # ✅ Agent implementations (unchanged)
│   ├── agent-utils.ts
│   ├── deep-research-agent.ts
│   ├── quick-deep-research-agent.ts
│   ├── ultra-deep-research-agent.ts
│   ├── web-search-agent.ts
│   └── findall-agent.ts
│
├── tools/                           # ✅ Tool definitions (unchanged)
│   ├── deep-research-tools.ts
│   ├── findall-tools.ts
│   └── web-search-tools.ts
│
├── features/                        # ✨ NEW: Feature-based organization
│   │
│   ├── deep-research/
│   │   ├── deep-research-agent.controller.ts
│   │   ├── deep-research-agent.module.ts
│   │   └── services/
│   │       ├── deep-research-agent.service.ts
│   │       └── deep-research-streaming.service.ts
│   │
│   ├── quick-deep-research/
│   │   ├── quick-deep-research-agent.controller.ts
│   │   ├── quick-deep-research-agent.module.ts
│   │   └── services/
│   │       ├── quick-deep-research-agent.service.ts
│   │       └── quick-deep-research-streaming.service.ts
│   │
│   ├── ultra-deep-research/
│   │   ├── ultra-deep-research-agent.controller.ts
│   │   ├── ultra-deep-research-agent.module.ts
│   │   └── services/
│   │       ├── ultra-deep-research-agent.service.ts
│   │       └── ultra-deep-research-streaming.service.ts
│   │
│   ├── web-search/
│   │   ├── web-search-agent.controller.ts
│   │   ├── web-search-agent.module.ts
│   │   └── services/
│   │       ├── web-search-agent.service.ts
│   │       └── web-search-streaming.service.ts
│   │
│   └── findall/
│       ├── findall-agent.controller.ts
│       ├── findall-agent.module.ts
│       └── services/
│           ├── findall-agent.service.ts
│           └── findall-streaming.service.ts
│
├── shared/                          # ✨ NEW: Shared infrastructure
│   ├── services/
│   │   ├── base-research-agent.service.ts
│   │   └── streaming/
│   │       ├── base-task-streaming.service.ts
│   │       └── parallel-sse.service.ts
│   └── storage/
│       └── memory-store.ts
│
└── index.ts                         # Main exports
```

## Detailed File Movement Plan

### 📁 Feature: Deep Research
| From | To |
|------|-----|
| `deep-research-agent.controller.ts` | `features/deep-research/deep-research-agent.controller.ts` |
| `deep-research-agent.module.ts` | `features/deep-research/deep-research-agent.module.ts` |
| `services/deep-research-agent.service.ts` | `features/deep-research/services/deep-research-agent.service.ts` |
| `services/streaming/deep-research-streaming.service.ts` | `features/deep-research/services/deep-research-streaming.service.ts` |

### 📁 Feature: Quick Deep Research
| From | To |
|------|-----|
| `quick-deep-research-agent.controller.ts` | `features/quick-deep-research/quick-deep-research-agent.controller.ts` |
| `quick-deep-research-agent.module.ts` | `features/quick-deep-research/quick-deep-research-agent.module.ts` |
| `services/quick-deep-research-agent.service.ts` | `features/quick-deep-research/services/quick-deep-research-agent.service.ts` |
| `services/streaming/quick-deep-research-streaming.service.ts` | `features/quick-deep-research/services/quick-deep-research-streaming.service.ts` |

### 📁 Feature: Ultra Deep Research
| From | To |
|------|-----|
| `ultra-deep-research-agent.controller.ts` | `features/ultra-deep-research/ultra-deep-research-agent.controller.ts` |
| `ultra-deep-research-agent.module.ts` | `features/ultra-deep-research/ultra-deep-research-agent.module.ts` |
| `services/ultra-deep-research-agent.service.ts` | `features/ultra-deep-research/services/ultra-deep-research-agent.service.ts` |
| `services/streaming/ultra-deep-research-streaming.service.ts` | `features/ultra-deep-research/services/ultra-deep-research-streaming.service.ts` |

### 📁 Feature: Web Search
| From | To |
|------|-----|
| `web-search-agent.controller.ts` | `features/web-search/web-search-agent.controller.ts` |
| `web-search-agent.module.ts` | `features/web-search/web-search-agent.module.ts` |
| `services/web-search-agent.service.ts` | `features/web-search/services/web-search-agent.service.ts` |
| `services/streaming/web-search-streaming.service.ts` | `features/web-search/services/web-search-streaming.service.ts` |

### 📁 Feature: FindAll
| From | To |
|------|-----|
| `findall-agent.controller.ts` | `features/findall/findall-agent.controller.ts` |
| `findall-agent.module.ts` | `features/findall/findall-agent.module.ts` |
| `services/findall-agent.service.ts` | `features/findall/services/findall-agent.service.ts` |
| `services/streaming/findall-streaming.service.ts` | `features/findall/services/findall-streaming.service.ts` |

### 📁 Shared Infrastructure
| From | To |
|------|-----|
| `services/base-research-agent.service.ts` | `shared/services/base-research-agent.service.ts` |
| `services/streaming/base-task-streaming.service.ts` | `shared/services/streaming/base-task-streaming.service.ts` |
| `services/streaming/parallel-sse.service.ts` | `shared/services/streaming/parallel-sse.service.ts` |
| `memoryStore.ts` | `shared/storage/memory-store.ts` |

## Import Path Updates Required

### Controllers
All controllers will need to update imports:

**deep-research-agent.controller.ts:**
- ❌ `'./services/deep-research-agent.service'` 
- ✅ `'./services/deep-research-agent.service'` (same - relative within feature)
- ❌ `'./services/streaming/deep-research-streaming.service'`
- ✅ `'./services/deep-research-streaming.service'` (simpler - within feature)

**All controllers:**
- Update relative paths to services within their feature folder

### Modules
All modules will need to update imports:

**deep-research-agent.module.ts:**
- ❌ `'./deep-research-agent.controller'`
- ✅ `'./deep-research-agent.controller'` (same)
- ❌ `'./services/deep-research-agent.service'`
- ✅ `'./services/deep-research-agent.service'` (same)
- ❌ `'./services/streaming/parallel-sse.service'`
- ✅ `'../../shared/services/streaming/parallel-sse.service'`
- ❌ `'./common/parallel-task.service'`
- ✅ `'../../common/parallel-task.service'`
- ❌ `'./common/file-logger.service'`
- ✅ `'../../common/file-logger.service'`

### Services
All services will need to update imports:

**Agent Services (e.g., deep-research-agent.service.ts):**
- ❌ `'../tools/deep-research-tools'`
- ✅ `'../../../tools/deep-research-tools'`
- ❌ `'../deep-research-agent.controller'`
- ✅ `'../deep-research-agent.controller'` (same - within feature)
- ❌ `'./base-research-agent.service'`
- ✅ `'../../../shared/services/base-research-agent.service'`

**Streaming Services (e.g., deep-research-streaming.service.ts):**
- ❌ `'./base-task-streaming.service'`
- ✅ `'../../../shared/services/streaming/base-task-streaming.service'`
- ❌ `'./parallel-sse.service'`
- ✅ `'../../../shared/services/streaming/parallel-sse.service'`
- ❌ `'../../common/parallel-task.service'`
- ✅ `'../../../common/parallel-task.service'`

### Shared Services
**base-research-agent.service.ts:**
- ❌ `'../index'`
- ✅ `'../../index'` (to access mastra instance)

**base-task-streaming.service.ts:**
- ❌ `'../../common/parallel-task.service'`
- ✅ `'../../common/parallel-task.service'` (same path)
- ❌ `'./parallel-sse.service'`
- ✅ `'./parallel-sse.service'` (same - within shared/streaming)

**parallel-sse.service.ts:**
- ❌ `'../../common/file-logger.service'`
- ✅ `'../../common/file-logger.service'` (same path)

### App Module
**app.module.ts:**
- ❌ `'./mastra/web-search-agent.module'`
- ✅ `'./mastra/features/web-search/web-search-agent.module'`
- (Same pattern for all 5 modules)

### Index File
**mastra/index.ts:**
- ❌ `'./memoryStore'`
- ✅ `'./shared/storage/memory-store'`
- All agent imports remain the same (agents/ folder unchanged)

## Summary Statistics

### Files to Move
- **Controllers**: 5 files
- **Modules**: 5 files
- **Agent Services**: 5 files
- **Streaming Services**: 5 files
- **Shared Services**: 3 files
- **Storage**: 1 file
- **Total**: 24 files

### Directories to Create
- `features/deep-research/services/`
- `features/quick-deep-research/services/`
- `features/ultra-deep-research/services/`
- `features/web-search/services/`
- `features/findall/services/`
- `shared/services/streaming/`
- `shared/storage/`
- **Total**: 8 directories

### Import Updates
- **Controllers**: ~10 files (5 controllers + their dependencies)
- **Modules**: ~10 files (5 modules + dependencies)
- **Services**: ~15 files (all service files)
- **Shared Services**: ~3 files
- **App Module**: 1 file
- **Index**: 1 file
- **Total**: ~40 files need import path updates

## Benefits

### ✅ Before Reorganization
- Files scattered across multiple directories
- Hard to find related files
- Inconsistent organization
- Difficult to understand feature boundaries

### ✅ After Reorganization
- **Feature cohesion** - All files for one feature together
- **Easy navigation** - Clear directory structure
- **Scalability** - Easy to add new features
- **Industry standard** - Follows NestJS patterns
- **Better maintainability** - Clear separation of concerns
- **Team collaboration** - Easier to work on features independently

## Migration Strategy

### Phase 1: Create Structure
1. Create all new directories
2. Verify directory structure

### Phase 2: Move Files
1. Move shared files first (shared/services, shared/storage)
2. Move feature files (one feature at a time)
3. Update imports after each feature move

### Phase 3: Update Imports
1. Update all import paths
2. Update app.module.ts
3. Update index.ts

### Phase 4: Verification
1. Run build to check for errors
2. Fix any import issues
3. Verify all modules load correctly

## Alternative: Option 2 - Layer-Based (Not Recommended)

If you prefer layer-based organization instead:

```
src/mastra/
├── controllers/      # All controllers
├── modules/          # All modules
├── services/         # All services
└── ...
```

**Why not recommended**: Less cohesive, harder to find related files, doesn't scale as well.

## Recommendation

✅ **Option 1 (Feature-Based)** is the clear winner because:
- Industry standard for NestJS
- Better code organization
- Easier to maintain
- Scales well with growth
- Clear feature boundaries

---

## Next Steps

**Please review this plan and approve:**

1. ✅ Approve Option 1 (Feature-Based)
2. ❌ Request Option 2 (Layer-Based)
3. 📝 Request modifications to the plan

Once approved, I will proceed with the complete reorganization including:
- Creating all directories
- Moving all files
- Updating all imports
- Verifying build succeeds
- Ensuring no functionality breaks
