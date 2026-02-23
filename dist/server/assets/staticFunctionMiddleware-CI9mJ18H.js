import minpath from "node:path";
import { createElement } from "react";
import { icons } from "lucide-react";
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { server } from "fumadocs-mdx/runtime/server";
import fs from "node:fs/promises";
import { I as Iu, a as getDefaultSerovalPlugins, A as Au } from "../server.js";
const createMiddleware = (options, __opts) => {
  const resolvedOptions = {
    type: "request",
    ...__opts || options
  };
  return {
    options: resolvedOptions,
    middleware: (middleware) => {
      return createMiddleware(
        {},
        Object.assign(resolvedOptions, { middleware })
      );
    },
    inputValidator: (inputValidator) => {
      return createMiddleware(
        {},
        Object.assign(resolvedOptions, { inputValidator })
      );
    },
    client: (client) => {
      return createMiddleware(
        {},
        Object.assign(resolvedOptions, { client })
      );
    },
    server: (server2) => {
      return createMiddleware(
        {},
        Object.assign(resolvedOptions, { server: server2 })
      );
    }
  };
};
function normalizeUrl(url) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (!url.startsWith("/")) url = "/" + url;
  if (url.length > 1 && url.endsWith("/")) url = url.slice(0, -1);
  return url;
}
function findPath(nodes, matcher, options = {}) {
  const { includeSeparator = true } = options;
  function run(nodes2) {
    let separator2;
    for (const node of nodes2) {
      if (matcher(node)) {
        const items = [];
        if (separator2) items.push(separator2);
        items.push(node);
        return items;
      }
      if (node.type === "separator" && includeSeparator) {
        separator2 = node;
        continue;
      }
      if (node.type === "folder") {
        const items = node.index && matcher(node.index) ? [node.index] : run(node.children);
        if (items) {
          items.unshift(node);
          if (separator2) items.unshift(separator2);
          return items;
        }
      }
    }
  }
  return run(nodes) ?? null;
}
const VisitBreak = /* @__PURE__ */ Symbol("VisitBreak");
function visit(root, visitor) {
  function onNode(node, parent) {
    const result = visitor(node, parent);
    switch (result) {
      case "skip":
        return node;
      case "break":
        throw VisitBreak;
      default:
        if (result) node = result;
    }
    if ("index" in node && node.index) node.index = onNode(node.index, node);
    if ("fallback" in node && node.fallback) node.fallback = onNode(node.fallback, node);
    if ("children" in node) for (let i = 0; i < node.children.length; i++) node.children[i] = onNode(node.children[i], node);
    return node;
  }
  try {
    return onNode(root);
  } catch (e) {
    if (e === VisitBreak) return root;
    throw e;
  }
}
function basename(path, ext) {
  const idx = path.lastIndexOf("/");
  return path.substring(idx === -1 ? 0 : idx + 1, ext ? path.length - ext.length : path.length);
}
function extname(path) {
  const dotIdx = path.lastIndexOf(".");
  if (dotIdx !== -1) return path.substring(dotIdx);
  return "";
}
function dirname(path) {
  return path.split("/").slice(0, -1).join("/");
}
function splitPath(path) {
  return path.split("/").filter((p) => p.length > 0);
}
function joinPath(...paths) {
  const out = [];
  const parsed = paths.flatMap(splitPath);
  for (const seg of parsed) switch (seg) {
    case "..":
      out.pop();
      break;
    case ".":
      break;
    default:
      out.push(seg);
  }
  return out.join("/");
}
function slash(path) {
  if (path.startsWith("\\\\?\\")) return path;
  return path.replaceAll("\\", "/");
}
function slugsPlugin(slugFn) {
  function isIndex(file) {
    return basename(file, extname(file)) === "index";
  }
  return {
    name: "fumadocs:slugs",
    transformStorage({ storage }) {
      const indexFiles = [];
      const taken = /* @__PURE__ */ new Set();
      for (const path of storage.getFiles()) {
        const file = storage.read(path);
        if (!file || file.format !== "page" || file.slugs) continue;
        const customSlugs = slugFn?.(file);
        if (customSlugs === void 0 && isIndex(path)) {
          indexFiles.push(path);
          continue;
        }
        file.slugs = customSlugs ?? getSlugs(path);
        const key = file.slugs.join("/");
        if (taken.has(key)) throw new Error(`Duplicated slugs: ${key}`);
        taken.add(key);
      }
      for (const path of indexFiles) {
        const file = storage.read(path);
        if (file?.format !== "page") continue;
        file.slugs = getSlugs(path);
        if (taken.has(file.slugs.join("/"))) file.slugs.push("index");
      }
    }
  };
}
const GroupRegex = /^\(.+\)$/;
function getSlugs(file) {
  const dir = dirname(file);
  const name = basename(file, extname(file));
  const slugs = [];
  for (const seg of dir.split("/")) if (seg.length > 0 && !GroupRegex.test(seg)) slugs.push(encodeURI(seg));
  if (GroupRegex.test(name)) throw new Error(`Cannot use folder group in file names: ${file}`);
  if (name !== "index") slugs.push(encodeURI(name));
  return slugs;
}
function iconPlugin(resolveIcon) {
  function replaceIcon(node) {
    if (node.icon === void 0 || typeof node.icon === "string") node.icon = resolveIcon(node.icon);
    return node;
  }
  return {
    name: "fumadocs:icon",
    transformPageTree: {
      file: replaceIcon,
      folder: replaceIcon,
      separator: replaceIcon
    }
  };
}
var FileSystem = class {
  constructor(inherit) {
    this.files = /* @__PURE__ */ new Map();
    this.folders = /* @__PURE__ */ new Map();
    if (inherit) {
      for (const [k, v] of inherit.folders) this.folders.set(k, v);
      for (const [k, v] of inherit.files) this.files.set(k, v);
    } else this.folders.set("", []);
  }
  read(path) {
    return this.files.get(path);
  }
  /**
  * get the direct children of folder (in virtual file path)
  */
  readDir(path) {
    return this.folders.get(path);
  }
  write(path, file) {
    if (!this.files.has(path)) {
      const dir = dirname(path);
      this.makeDir(dir);
      this.readDir(dir)?.push(path);
    }
    this.files.set(path, file);
  }
  /**
  * Delete files at specified path.
  *
  * @param path - the target path.
  * @param [recursive=false] - if set to `true`, it will also delete directories.
  */
  delete(path, recursive = false) {
    if (this.files.delete(path)) return true;
    if (recursive) {
      const folder = this.folders.get(path);
      if (!folder) return false;
      this.folders.delete(path);
      for (const child of folder) this.delete(child);
      return true;
    }
    return false;
  }
  getFiles() {
    return Array.from(this.files.keys());
  }
  makeDir(path) {
    const segments = splitPath(path);
    for (let i = 0; i < segments.length; i++) {
      const segment = segments.slice(0, i + 1).join("/");
      if (this.folders.has(segment)) continue;
      this.folders.set(segment, []);
      this.folders.get(dirname(segment)).push(segment);
    }
  }
};
function isLocaleValid(locale) {
  return locale.length > 0 && !/\d+/.test(locale);
}
const parsers = {
  dir(path) {
    const [locale, ...segs] = path.split("/");
    if (locale && segs.length > 0 && isLocaleValid(locale)) return [segs.join("/"), locale];
    return [path];
  },
  dot(path) {
    const dir = dirname(path);
    const parts = basename(path).split(".");
    if (parts.length < 3) return [path];
    const [locale] = parts.splice(parts.length - 2, 1);
    if (!isLocaleValid(locale)) return [path];
    return [joinPath(dir, parts.join(".")), locale];
  },
  none(path) {
    return [path];
  }
};
const EmptyLang = /* @__PURE__ */ Symbol();
function createContentStorageBuilder(loaderConfig) {
  const { source: source2, plugins = [], i18n } = loaderConfig;
  const parser = i18n ? parsers[i18n.parser ?? "dot"] : parsers.none;
  const normalized = /* @__PURE__ */ new Map();
  for (const inputFile of source2.files) {
    let file;
    if (inputFile.type === "page") file = {
      format: "page",
      path: normalizePath(inputFile.path),
      slugs: inputFile.slugs,
      data: inputFile.data,
      absolutePath: inputFile.absolutePath
    };
    else file = {
      format: "meta",
      path: normalizePath(inputFile.path),
      absolutePath: inputFile.absolutePath,
      data: inputFile.data
    };
    const [pathWithoutLocale, locale = i18n ? i18n.defaultLanguage : EmptyLang] = parser(file.path);
    const list = normalized.get(locale) ?? [];
    list.push({
      pathWithoutLocale,
      file
    });
    normalized.set(locale, list);
  }
  function makeStorage(locale, inherit) {
    const storage = new FileSystem(inherit);
    for (const { pathWithoutLocale, file } of normalized.get(locale) ?? []) storage.write(pathWithoutLocale, file);
    const context = { storage };
    for (const plugin of plugins) plugin.transformStorage?.(context);
    return storage;
  }
  return {
    i18n() {
      const storages = {};
      if (!i18n) return storages;
      const fallbackLang = i18n.fallbackLanguage !== null ? i18n.fallbackLanguage ?? i18n.defaultLanguage : null;
      function scan(lang) {
        if (storages[lang]) return storages[lang];
        return storages[lang] = makeStorage(lang, fallbackLang && fallbackLang !== lang ? scan(fallbackLang) : void 0);
      }
      for (const lang of i18n.languages) scan(lang);
      return storages;
    },
    single() {
      return makeStorage(EmptyLang);
    }
  };
}
function normalizePath(path) {
  const segments = splitPath(slash(path));
  if (segments[0] === "." || segments[0] === "..") throw new Error("It must not start with './' or '../'");
  return segments.join("/");
}
function transformerFallback() {
  const addedFiles = /* @__PURE__ */ new Set();
  function shouldIgnore(context) {
    return context.custom?._fallback === true;
  }
  return {
    root(root) {
      if (shouldIgnore(this)) return root;
      const isolatedStorage = new FileSystem();
      if (addedFiles.size === this.storage.files.size) return root;
      for (const file of this.storage.getFiles()) {
        if (addedFiles.has(file)) continue;
        isolatedStorage.write(file, this.storage.read(file));
      }
      root.fallback = new PageTreeBuilder(isolatedStorage, {
        idPrefix: this.idPrefix ? `fallback:${this.idPrefix}` : "fallback",
        url: this.getUrl,
        noRef: this.noRef,
        transformers: this.transformers,
        generateFallback: false,
        context: {
          ...this.custom,
          _fallback: true
        }
      }).root();
      addedFiles.clear();
      return root;
    },
    file(node, file) {
      if (shouldIgnore(this)) return node;
      if (file) addedFiles.add(file);
      return node;
    },
    folder(node, _dir, metaPath) {
      if (shouldIgnore(this)) return node;
      if (metaPath) addedFiles.add(metaPath);
      return node;
    }
  };
}
const group = /^\((?<name>.+)\)$/;
const link = /^(?<external>external:)?(?:\[(?<icon>[^\]]+)])?\[(?<name>[^\]]+)]\((?<url>[^)]+)\)$/;
const separator = /^---(?:\[(?<icon>[^\]]+)])?(?<name>.+)---|^---$/;
const rest = "...";
const restReversed = "z...a";
const extractPrefix = "...";
const excludePrefix = "!";
var PageTreeBuilder = class {
  constructor(input, options) {
    this.flattenPathToFullPath = /* @__PURE__ */ new Map();
    this.transformers = [];
    this.pathToNode = /* @__PURE__ */ new Map();
    this.unfinished = /* @__PURE__ */ new WeakSet();
    this.ownerMap = /* @__PURE__ */ new Map();
    this._nextId = 0;
    const { transformers, url, context, generateFallback = true, idPrefix = "", noRef = false } = options;
    if (transformers) this.transformers.push(...transformers);
    if (generateFallback) this.transformers.push(transformerFallback());
    this.ctx = {
      builder: this,
      idPrefix,
      getUrl: url,
      storage: void 0,
      noRef,
      transformers: this.transformers,
      custom: context
    };
    if (Array.isArray(input)) {
      const [locale, storages] = input;
      this.ctx.storage = this.storage = storages[locale];
      this.ctx.locale = locale;
      this.ctx.storages = storages;
    } else this.ctx.storage = this.storage = input;
    for (const file of this.storage.getFiles()) {
      const content = this.storage.read(file);
      const flattenPath = file.substring(0, file.length - extname(file).length);
      this.flattenPathToFullPath.set(flattenPath + "." + content.format, file);
    }
  }
  resolveFlattenPath(name, format) {
    return this.flattenPathToFullPath.get(name + "." + format) ?? name;
  }
  /**
  * try to register as the owner of `node`.
  *
  * when a node is referenced by multiple folders, this determines which folder they should belong to.
  *
  * @returns whether the owner owns the node.
  */
  own(ownerPath, node, priority) {
    if (this.unfinished.has(node)) return false;
    const existing = this.ownerMap.get(node);
    if (!existing) {
      this.ownerMap.set(node, {
        owner: ownerPath,
        priority
      });
      return true;
    }
    if (existing.owner === ownerPath) {
      existing.priority = Math.max(existing.priority, priority);
      return true;
    }
    if (existing.priority >= priority) return false;
    const folder = this.pathToNode.get(existing.owner);
    if (folder && folder.type === "folder") if (folder.index === node) delete folder.index;
    else {
      const idx = folder.children.indexOf(node);
      if (idx !== -1) folder.children.splice(idx, 1);
    }
    existing.owner = ownerPath;
    existing.priority = priority;
    return true;
  }
  transferOwner(ownerPath, node) {
    const existing = this.ownerMap.get(node);
    if (existing) existing.owner = ownerPath;
  }
  generateId(localId = `_${this._nextId++}`) {
    let id = localId;
    if (this.ctx.locale) id = `${this.ctx.locale}:${id}`;
    if (this.ctx.idPrefix) id = `${this.ctx.idPrefix}:${id}`;
    return id;
  }
  buildPaths(paths, filter, reversed = false) {
    const items = [];
    const folders = [];
    const sortedPaths = paths.sort((a, b) => reversed ? b.localeCompare(a) : a.localeCompare(b));
    for (const path of sortedPaths) {
      if (filter && !filter(path)) continue;
      const fileNode = this.file(path);
      if (fileNode) {
        if (basename(path, extname(path)) === "index") items.unshift(fileNode);
        else items.push(fileNode);
        continue;
      }
      const dirNode = this.folder(path);
      if (dirNode) folders.push(dirNode);
    }
    items.push(...folders);
    return items;
  }
  resolveFolderItem(folderPath, item, outputArray, excludedPaths) {
    if (item === rest || item === restReversed) {
      outputArray.push(item);
      return;
    }
    let match = separator.exec(item);
    if (match?.groups) {
      let node2 = {
        $id: this.generateId(),
        type: "separator",
        icon: match.groups.icon,
        name: match.groups.name
      };
      for (const transformer of this.transformers) {
        if (!transformer.separator) continue;
        node2 = transformer.separator.call(this.ctx, node2);
      }
      outputArray.push(node2);
      return;
    }
    match = link.exec(item);
    if (match?.groups) {
      const { icon, url, name, external } = match.groups;
      let node2 = {
        $id: this.generateId(),
        type: "page",
        icon,
        name,
        url
      };
      if (external) node2.external = true;
      for (const transformer of this.transformers) {
        if (!transformer.file) continue;
        node2 = transformer.file.call(this.ctx, node2);
      }
      outputArray.push(node2);
      return;
    }
    if (item.startsWith(excludePrefix)) {
      const path2 = joinPath(folderPath, item.slice(1));
      excludedPaths.add(path2);
      excludedPaths.add(this.resolveFlattenPath(path2, "page"));
      return;
    }
    if (item.startsWith(extractPrefix)) {
      const path2 = joinPath(folderPath, item.slice(3));
      const node2 = this.folder(path2);
      if (!node2) return;
      const children = node2.index ? [node2.index, ...node2.children] : node2.children;
      if (this.own(folderPath, node2, 2)) {
        for (const child of children) {
          this.transferOwner(folderPath, child);
          outputArray.push(child);
        }
        excludedPaths.add(path2);
      } else for (const child of children) if (this.own(folderPath, child, 2)) outputArray.push(child);
      return;
    }
    let path = joinPath(folderPath, item);
    let node = this.folder(path);
    if (!node) {
      path = this.resolveFlattenPath(path, "page");
      node = this.file(path);
    }
    if (!node || !this.own(folderPath, node, 2)) return;
    outputArray.push(node);
    excludedPaths.add(path);
  }
  folder(folderPath) {
    const cached = this.pathToNode.get(folderPath);
    if (cached) return cached;
    const files = this.storage.readDir(folderPath);
    if (!files) return;
    const isGlobalRoot = folderPath === "";
    const metaPath = this.resolveFlattenPath(joinPath(folderPath, "meta"), "meta");
    const indexPath = this.resolveFlattenPath(joinPath(folderPath, "index"), "page");
    let meta = this.storage.read(metaPath);
    if (meta && meta.format !== "meta") meta = void 0;
    const metadata = meta?.data ?? {};
    let node = {
      type: "folder",
      name: null,
      root: metadata.root,
      defaultOpen: metadata.defaultOpen,
      description: metadata.description,
      collapsible: metadata.collapsible,
      children: [],
      $id: this.generateId(folderPath),
      $ref: !this.ctx.noRef && meta ? { metaFile: metaPath } : void 0
    };
    this.pathToNode.set(folderPath, node);
    this.unfinished.add(node);
    if (!(metadata.root ?? isGlobalRoot)) {
      const file = this.file(indexPath);
      if (file && this.own(folderPath, file, 0)) node.index = file;
    }
    if (metadata.pages) {
      const outputArray = [];
      const excludedPaths = /* @__PURE__ */ new Set();
      for (const item of metadata.pages) this.resolveFolderItem(folderPath, item, outputArray, excludedPaths);
      if (excludedPaths.has(indexPath)) delete node.index;
      else if (node.index) excludedPaths.add(indexPath);
      for (const item of outputArray) {
        if (item !== rest && item !== restReversed) {
          node.children.push(item);
          continue;
        }
        const resolvedItem = this.buildPaths(files, (file) => !excludedPaths.has(file), item === restReversed);
        for (const child of resolvedItem) if (this.own(folderPath, child, 0)) node.children.push(child);
      }
    } else for (const item of this.buildPaths(files, node.index ? (file) => file !== indexPath : void 0)) if (this.own(folderPath, item, 0)) node.children.push(item);
    node.icon = metadata.icon ?? node.index?.icon;
    node.name = metadata.title ?? node.index?.name;
    this.unfinished.delete(node);
    if (!node.name) {
      const folderName = basename(folderPath);
      node.name = pathToName(group.exec(folderName)?.[1] ?? folderName);
    }
    for (const transformer of this.transformers) {
      if (!transformer.folder) continue;
      node = transformer.folder.call(this.ctx, node, folderPath, meta ? metaPath : void 0);
    }
    this.pathToNode.set(folderPath, node);
    return node;
  }
  file(path) {
    const cached = this.pathToNode.get(path);
    if (cached) return cached;
    const page = this.storage.read(path);
    if (!page || page.format !== "page") return;
    const { title, description, icon } = page.data;
    let item = {
      $id: this.generateId(path),
      type: "page",
      name: title ?? pathToName(basename(path, extname(path))),
      description,
      icon,
      url: this.ctx.getUrl(page.slugs, this.ctx.locale),
      $ref: !this.ctx.noRef ? { file: path } : void 0
    };
    for (const transformer of this.transformers) {
      if (!transformer.file) continue;
      item = transformer.file.call(this.ctx, item, path);
    }
    this.pathToNode.set(path, item);
    return item;
  }
  root(id = "root", path = "") {
    const folder = this.folder(path);
    let root = {
      $id: this.generateId(id),
      name: folder?.name || "Docs",
      children: folder ? folder.children : []
    };
    for (const transformer of this.transformers) {
      if (!transformer.root) continue;
      root = transformer.root.call(this.ctx, root);
    }
    return root;
  }
};
function pathToName(name) {
  const result = [];
  for (const c of name) if (result.length === 0) result.push(c.toLocaleUpperCase());
  else if (c === "-") result.push(" ");
  else result.push(c);
  return result.join("");
}
function createPageIndexer({ url }) {
  const pages = /* @__PURE__ */ new Map();
  const pathToMeta = /* @__PURE__ */ new Map();
  const pathToPage = /* @__PURE__ */ new Map();
  return {
    scan(storage, lang) {
      for (const filePath of storage.getFiles()) {
        const item = storage.read(filePath);
        const prefix = lang ? `${lang}.` : ".";
        const path = prefix + filePath;
        if (item.format === "meta") {
          pathToMeta.set(path, {
            path: item.path,
            absolutePath: item.absolutePath,
            data: item.data
          });
          continue;
        }
        const page = {
          absolutePath: item.absolutePath,
          path: item.path,
          url: url(item.slugs, lang),
          slugs: item.slugs,
          data: item.data,
          locale: lang
        };
        pathToPage.set(path, page);
        pages.set(prefix + page.slugs.join("/"), page);
      }
    },
    getPage(path, lang = "") {
      return pathToPage.get(`${lang}.${path}`);
    },
    getMeta(path, lang = "") {
      return pathToMeta.get(`${lang}.${path}`);
    },
    getPageBySlugs(slugs, lang = "") {
      let page = pages.get(`${lang}.${slugs.join("/")}`);
      if (page) return page;
      page = pages.get(`${lang}.${slugs.map(decodeURI).join("/")}`);
      if (page) return page;
    },
    getPages(lang) {
      const out = [];
      for (const [key, value] of pages.entries()) if (lang === void 0 || key.startsWith(`${lang}.`)) out.push(value);
      return out;
    }
  };
}
function createGetUrl(baseUrl, i18n) {
  const baseSlugs = baseUrl.split("/");
  return (slugs, locale) => {
    const hideLocale = i18n?.hideLocale ?? "never";
    let urlLocale;
    if (hideLocale === "never") urlLocale = locale;
    else if (hideLocale === "default-locale" && locale !== i18n?.defaultLanguage) urlLocale = locale;
    const paths = [...baseSlugs, ...slugs];
    if (urlLocale) paths.unshift(urlLocale);
    return `/${paths.filter((v) => v.length > 0).join("/")}`;
  };
}
function loader(...args) {
  const loaderConfig = args.length === 2 ? resolveConfig(args[0], args[1]) : resolveConfig(args[0].source, args[0]);
  const { i18n } = loaderConfig;
  const storage = i18n ? createContentStorageBuilder(loaderConfig).i18n() : createContentStorageBuilder(loaderConfig).single();
  const indexer = createPageIndexer(loaderConfig);
  if (storage instanceof FileSystem) indexer.scan(storage);
  else for (const locale in storage) indexer.scan(storage[locale], locale);
  let pageTrees;
  function getPageTrees() {
    if (pageTrees) return pageTrees;
    const { plugins = [], url, pageTree: pageTreeConfig } = loaderConfig;
    const transformers = [];
    if (pageTreeConfig?.transformers) transformers.push(...pageTreeConfig.transformers);
    for (const plugin of plugins) if (plugin.transformPageTree) transformers.push(plugin.transformPageTree);
    const options = {
      url,
      ...pageTreeConfig,
      transformers
    };
    if (storage instanceof FileSystem) return pageTrees = new PageTreeBuilder(storage, options).root();
    else {
      const out = {};
      for (const locale in storage) out[locale] = new PageTreeBuilder([locale, storage], options).root();
      return pageTrees = out;
    }
  }
  return {
    _i18n: i18n,
    get pageTree() {
      return getPageTrees();
    },
    set pageTree(v) {
      pageTrees = v;
    },
    getPageByHref(href, { dir = "", language = i18n?.defaultLanguage } = {}) {
      const [value, hash] = href.split("#", 2);
      let target;
      if (value.startsWith("./")) {
        const path = joinPath(dir, value);
        target = indexer.getPage(path, language);
      } else target = this.getPages(language).find((item) => item.url === value);
      if (target) return {
        page: target,
        hash
      };
    },
    resolveHref(href, parent) {
      if (href.startsWith("./")) {
        const target = this.getPageByHref(href, {
          dir: minpath.dirname(parent.path),
          language: parent.locale
        });
        if (target) return target.hash ? `${target.page.url}#${target.hash}` : target.page.url;
      }
      return href;
    },
    getPages(language) {
      return indexer.getPages(language);
    },
    getLanguages() {
      const list = [];
      if (!i18n) return list;
      for (const language of i18n.languages) list.push({
        language,
        pages: this.getPages(language)
      });
      return list;
    },
    getPage(slugs = [], language = i18n?.defaultLanguage) {
      return indexer.getPageBySlugs(slugs, language);
    },
    getNodeMeta(node, language = i18n?.defaultLanguage) {
      const ref = node.$ref?.metaFile;
      if (!ref) return;
      return indexer.getMeta(ref, language);
    },
    getNodePage(node, language = i18n?.defaultLanguage) {
      const ref = node.$ref?.file;
      if (!ref) return;
      return indexer.getPage(ref, language);
    },
    getPageTree(locale) {
      if (i18n) {
        const trees = getPageTrees();
        if (locale && trees[locale]) return trees[locale];
        return trees[i18n.defaultLanguage];
      }
      return getPageTrees();
    },
    generateParams(slug, lang) {
      if (i18n) return this.getLanguages().flatMap((entry) => entry.pages.map((page) => ({
        [slug ?? "slug"]: page.slugs,
        [lang ?? "lang"]: entry.language
      })));
      return this.getPages().map((page) => ({ [slug ?? "slug"]: page.slugs }));
    },
    async serializePageTree(tree) {
      const { renderToString } = await import("react-dom/server.edge");
      return {
        $fumadocs_loader: "page-tree",
        data: visit(tree, (node) => {
          node = { ...node };
          if ("icon" in node && node.icon) node.icon = renderToString(node.icon);
          if (node.name) node.name = renderToString(node.name);
          if ("children" in node) node.children = [...node.children];
          return node;
        })
      };
    }
  };
}
function resolveConfig(source2, { slugs, icon, plugins = [], baseUrl, url, ...base }) {
  let config = {
    ...base,
    url: url ? (...args) => normalizeUrl(url(...args)) : createGetUrl(baseUrl, base.i18n),
    source: source2,
    plugins: buildPlugins([
      icon && iconPlugin(icon),
      ...typeof plugins === "function" ? plugins({ typedPlugin: (plugin) => plugin }) : plugins,
      slugsPlugin(slugs)
    ])
  };
  for (const plugin of config.plugins ?? []) {
    const result = plugin.config?.(config);
    if (result) config = result;
  }
  return config;
}
const priorityMap = {
  pre: 1,
  default: 0,
  post: -1
};
function buildPlugins(plugins, sort = true) {
  const flatten = [];
  for (const plugin of plugins) if (Array.isArray(plugin)) flatten.push(...buildPlugins(plugin, false));
  else if (plugin) flatten.push(plugin);
  if (sort) return flatten.sort((a, b) => priorityMap[b.enforce ?? "default"] - priorityMap[a.enforce ?? "default"]);
  return flatten;
}
function lucideIconsPlugin(options = {}) {
  const { defaultIcon } = options;
  return iconPlugin((icon = defaultIcon) => {
    if (icon === void 0) return;
    const Icon = icons[icon];
    if (!Icon) {
      console.warn(`[lucide-icons-plugin] Unknown icon detected: ${icon}.`);
      return;
    }
    return createElement(Icon);
  });
}
let _markdown$1 = '\n\nHey there! Fumadocs is the docs framework that also works on Tanstack Start!\n\nHeading [#heading]\n\nHello World!\n\n<Cards>\n  <Card title="Learn more about Tanstack Start" href="https://tanstack.com/start" />\n\n  <Card title="Learn more about Fumadocs" href="https://fumadocs.dev" />\n</Cards>\n\nCodeBlock [#codeblock]\n\n```ts\nconsole.log(\'Hello World\');\n```\n\nTable [#table]\n\n| Head                            | Description                         |\n| ------------------------------- | ----------------------------------- |\n| `hello`                         | Hello World                         |\n| very **important**              | Hey                                 |\n| *Surprisingly*                  | Fumadocs                            |\n| very long text that looks weird | hello world hello world hello world |\n';
let frontmatter$1 = {
  "title": "Hello World",
  "description": "Your favourite docs framework.",
  "icon": "Rocket"
};
let structuredData$1 = {
  "contents": [{
    "heading": void 0,
    "content": "Hey there! Fumadocs is the docs framework that also works on Tanstack Start!"
  }, {
    "heading": "heading",
    "content": "Hello World!"
  }, {
    "heading": "heading",
    "content": '<Card title="Learn more about Tanstack Start" href="https://tanstack.com/start" />'
  }, {
    "heading": "heading",
    "content": '<Card title="Learn more about Fumadocs" href="https://fumadocs.dev" />'
  }, {
    "heading": "table",
    "content": "Head"
  }, {
    "heading": "table",
    "content": "Description"
  }, {
    "heading": "table",
    "content": "`hello`"
  }, {
    "heading": "table",
    "content": "Hello World"
  }, {
    "heading": "table",
    "content": "very **important**"
  }, {
    "heading": "table",
    "content": "Hey"
  }, {
    "heading": "table",
    "content": "*Surprisingly*"
  }, {
    "heading": "table",
    "content": "Fumadocs"
  }, {
    "heading": "table",
    "content": "very long text that looks weird"
  }, {
    "heading": "table",
    "content": "hello world hello world hello world"
  }],
  "headings": [{
    "id": "heading",
    "content": "Heading"
  }, {
    "id": "codeblock",
    "content": "CodeBlock"
  }, {
    "id": "table",
    "content": "Table"
  }]
};
const toc$1 = [{
  depth: 2,
  url: "#heading",
  title: jsx(Fragment, {
    children: "Heading"
  })
}, {
  depth: 3,
  url: "#codeblock",
  title: jsx(Fragment, {
    children: "CodeBlock"
  })
}, {
  depth: 4,
  url: "#table",
  title: jsx(Fragment, {
    children: "Table"
  })
}];
function _createMdxContent$1(props) {
  const _components = {
    code: "code",
    em: "em",
    h2: "h2",
    h3: "h3",
    h4: "h4",
    p: "p",
    pre: "pre",
    span: "span",
    strong: "strong",
    table: "table",
    tbody: "tbody",
    td: "td",
    th: "th",
    thead: "thead",
    tr: "tr",
    ...props.components
  }, { Card, Cards } = _components;
  if (!Card) _missingMdxReference$1("Card");
  if (!Cards) _missingMdxReference$1("Cards");
  return jsxs(Fragment, {
    children: [jsx(_components.p, {
      children: "Hey there! Fumadocs is the docs framework that also works on Tanstack Start!"
    }), "\n", jsx(_components.h2, {
      id: "heading",
      children: "Heading"
    }), "\n", jsx(_components.p, {
      children: "Hello World!"
    }), "\n", jsxs(Cards, {
      children: [jsx(Card, {
        title: "Learn more about Tanstack Start",
        href: "https://tanstack.com/start"
      }), jsx(Card, {
        title: "Learn more about Fumadocs",
        href: "https://fumadocs.dev"
      })]
    }), "\n", jsx(_components.h3, {
      id: "codeblock",
      children: "CodeBlock"
    }), "\n", jsx(Fragment, {
      children: jsx(_components.pre, {
        className: "shiki shiki-themes github-light github-dark",
        style: {
          "--shiki-light": "#24292e",
          "--shiki-dark": "#e1e4e8",
          "--shiki-light-bg": "#fff",
          "--shiki-dark-bg": "#24292e"
        },
        tabIndex: "0",
        icon: '<svg viewBox="0 0 24 24"><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" fill="currentColor" /></svg>',
        children: jsx(_components.code, {
          children: jsxs(_components.span, {
            className: "line",
            children: [jsx(_components.span, {
              style: {
                "--shiki-light": "#24292E",
                "--shiki-dark": "#E1E4E8"
              },
              children: "console."
            }), jsx(_components.span, {
              style: {
                "--shiki-light": "#6F42C1",
                "--shiki-dark": "#B392F0"
              },
              children: "log"
            }), jsx(_components.span, {
              style: {
                "--shiki-light": "#24292E",
                "--shiki-dark": "#E1E4E8"
              },
              children: "("
            }), jsx(_components.span, {
              style: {
                "--shiki-light": "#032F62",
                "--shiki-dark": "#9ECBFF"
              },
              children: "'Hello World'"
            }), jsx(_components.span, {
              style: {
                "--shiki-light": "#24292E",
                "--shiki-dark": "#E1E4E8"
              },
              children: ");"
            })]
          })
        })
      })
    }), "\n", jsx(_components.h4, {
      id: "table",
      children: "Table"
    }), "\n", jsxs(_components.table, {
      children: [jsx(_components.thead, {
        children: jsxs(_components.tr, {
          children: [jsx(_components.th, {
            children: "Head"
          }), jsx(_components.th, {
            children: "Description"
          })]
        })
      }), jsxs(_components.tbody, {
        children: [jsxs(_components.tr, {
          children: [jsx(_components.td, {
            children: jsx(_components.code, {
              children: "hello"
            })
          }), jsx(_components.td, {
            children: "Hello World"
          })]
        }), jsxs(_components.tr, {
          children: [jsxs(_components.td, {
            children: ["very ", jsx(_components.strong, {
              children: "important"
            })]
          }), jsx(_components.td, {
            children: "Hey"
          })]
        }), jsxs(_components.tr, {
          children: [jsx(_components.td, {
            children: jsx(_components.em, {
              children: "Surprisingly"
            })
          }), jsx(_components.td, {
            children: "Fumadocs"
          })]
        }), jsxs(_components.tr, {
          children: [jsx(_components.td, {
            children: "very long text that looks weird"
          }), jsx(_components.td, {
            children: "hello world hello world hello world"
          })]
        })]
      })]
    })]
  });
}
function MDXContent$1(props = {}) {
  const { wrapper: MDXLayout } = props.components || {};
  return MDXLayout ? jsx(MDXLayout, {
    ...props,
    children: jsx(_createMdxContent$1, {
      ...props
    })
  }) : _createMdxContent$1(props);
}
function _missingMdxReference$1(id, component) {
  throw new Error("Expected component `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
const __vite_glob_1_0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  _markdown: _markdown$1,
  default: MDXContent$1,
  frontmatter: frontmatter$1,
  structuredData: structuredData$1,
  toc: toc$1
}, Symbol.toStringTag, { value: "Module" }));
let _markdown = '\n\nHello World again!\n\nInstallation [#installation]\n\n<CodeBlockTabs defaultValue="npm">\n  <CodeBlockTabsList>\n    <CodeBlockTabsTrigger value="npm">\n      npm\n    </CodeBlockTabsTrigger>\n\n    <CodeBlockTabsTrigger value="pnpm">\n      pnpm\n    </CodeBlockTabsTrigger>\n\n    <CodeBlockTabsTrigger value="yarn">\n      yarn\n    </CodeBlockTabsTrigger>\n\n    <CodeBlockTabsTrigger value="bun">\n      bun\n    </CodeBlockTabsTrigger>\n  </CodeBlockTabsList>\n\n  <CodeBlockTab value="npm">\n    ```bash\n    npm i fumadocs-core fumadocs-ui\n    ```\n  </CodeBlockTab>\n\n  <CodeBlockTab value="pnpm">\n    ```bash\n    pnpm add fumadocs-core fumadocs-ui\n    ```\n  </CodeBlockTab>\n\n  <CodeBlockTab value="yarn">\n    ```bash\n    yarn add fumadocs-core fumadocs-ui\n    ```\n  </CodeBlockTab>\n\n  <CodeBlockTab value="bun">\n    ```bash\n    bun add fumadocs-core fumadocs-ui\n    ```\n  </CodeBlockTab>\n</CodeBlockTabs>\n';
let frontmatter = {
  "title": "Test",
  "description": "This is another page"
};
let structuredData = {
  "contents": [{
    "heading": void 0,
    "content": "Hello World again!"
  }],
  "headings": [{
    "id": "installation",
    "content": "Installation"
  }]
};
const toc = [{
  depth: 2,
  url: "#installation",
  title: jsx(Fragment, {
    children: "Installation"
  })
}];
function _createMdxContent(props) {
  const _components = {
    code: "code",
    h2: "h2",
    p: "p",
    pre: "pre",
    span: "span",
    ...props.components
  }, { CodeBlockTab, CodeBlockTabs, CodeBlockTabsList, CodeBlockTabsTrigger } = _components;
  if (!CodeBlockTab) _missingMdxReference("CodeBlockTab");
  if (!CodeBlockTabs) _missingMdxReference("CodeBlockTabs");
  if (!CodeBlockTabsList) _missingMdxReference("CodeBlockTabsList");
  if (!CodeBlockTabsTrigger) _missingMdxReference("CodeBlockTabsTrigger");
  return jsxs(Fragment, {
    children: [jsx(_components.p, {
      children: "Hello World again!"
    }), "\n", jsx(_components.h2, {
      id: "installation",
      children: "Installation"
    }), "\n", jsxs(CodeBlockTabs, {
      defaultValue: "npm",
      children: [jsxs(CodeBlockTabsList, {
        children: [jsx(CodeBlockTabsTrigger, {
          value: "npm",
          children: "npm"
        }), jsx(CodeBlockTabsTrigger, {
          value: "pnpm",
          children: "pnpm"
        }), jsx(CodeBlockTabsTrigger, {
          value: "yarn",
          children: "yarn"
        }), jsx(CodeBlockTabsTrigger, {
          value: "bun",
          children: "bun"
        })]
      }), jsx(CodeBlockTab, {
        value: "npm",
        children: jsx(Fragment, {
          children: jsx(_components.pre, {
            className: "shiki shiki-themes github-light github-dark",
            style: {
              "--shiki-light": "#24292e",
              "--shiki-dark": "#e1e4e8",
              "--shiki-light-bg": "#fff",
              "--shiki-dark-bg": "#24292e"
            },
            tabIndex: "0",
            icon: '<svg viewBox="0 0 24 24"><path d="m 4,4 a 1,1 0 0 0 -0.7070312,0.2929687 1,1 0 0 0 0,1.4140625 L 8.5859375,11 3.2929688,16.292969 a 1,1 0 0 0 0,1.414062 1,1 0 0 0 1.4140624,0 l 5.9999998,-6 a 1.0001,1.0001 0 0 0 0,-1.414062 L 4.7070312,4.2929687 A 1,1 0 0 0 4,4 Z m 8,14 a 1,1 0 0 0 -1,1 1,1 0 0 0 1,1 h 8 a 1,1 0 0 0 1,-1 1,1 0 0 0 -1,-1 z" fill="currentColor" /></svg>',
            children: jsx(_components.code, {
              children: jsxs(_components.span, {
                className: "line",
                children: [jsx(_components.span, {
                  style: {
                    "--shiki-light": "#6F42C1",
                    "--shiki-dark": "#B392F0"
                  },
                  children: "npm"
                }), jsx(_components.span, {
                  style: {
                    "--shiki-light": "#032F62",
                    "--shiki-dark": "#9ECBFF"
                  },
                  children: " i"
                }), jsx(_components.span, {
                  style: {
                    "--shiki-light": "#032F62",
                    "--shiki-dark": "#9ECBFF"
                  },
                  children: " fumadocs-core"
                }), jsx(_components.span, {
                  style: {
                    "--shiki-light": "#032F62",
                    "--shiki-dark": "#9ECBFF"
                  },
                  children: " fumadocs-ui"
                })]
              })
            })
          })
        })
      }), jsx(CodeBlockTab, {
        value: "pnpm",
        children: jsx(Fragment, {
          children: jsx(_components.pre, {
            className: "shiki shiki-themes github-light github-dark",
            style: {
              "--shiki-light": "#24292e",
              "--shiki-dark": "#e1e4e8",
              "--shiki-light-bg": "#fff",
              "--shiki-dark-bg": "#24292e"
            },
            tabIndex: "0",
            icon: '<svg viewBox="0 0 24 24"><path d="m 4,4 a 1,1 0 0 0 -0.7070312,0.2929687 1,1 0 0 0 0,1.4140625 L 8.5859375,11 3.2929688,16.292969 a 1,1 0 0 0 0,1.414062 1,1 0 0 0 1.4140624,0 l 5.9999998,-6 a 1.0001,1.0001 0 0 0 0,-1.414062 L 4.7070312,4.2929687 A 1,1 0 0 0 4,4 Z m 8,14 a 1,1 0 0 0 -1,1 1,1 0 0 0 1,1 h 8 a 1,1 0 0 0 1,-1 1,1 0 0 0 -1,-1 z" fill="currentColor" /></svg>',
            children: jsx(_components.code, {
              children: jsxs(_components.span, {
                className: "line",
                children: [jsx(_components.span, {
                  style: {
                    "--shiki-light": "#6F42C1",
                    "--shiki-dark": "#B392F0"
                  },
                  children: "pnpm"
                }), jsx(_components.span, {
                  style: {
                    "--shiki-light": "#032F62",
                    "--shiki-dark": "#9ECBFF"
                  },
                  children: " add"
                }), jsx(_components.span, {
                  style: {
                    "--shiki-light": "#032F62",
                    "--shiki-dark": "#9ECBFF"
                  },
                  children: " fumadocs-core"
                }), jsx(_components.span, {
                  style: {
                    "--shiki-light": "#032F62",
                    "--shiki-dark": "#9ECBFF"
                  },
                  children: " fumadocs-ui"
                })]
              })
            })
          })
        })
      }), jsx(CodeBlockTab, {
        value: "yarn",
        children: jsx(Fragment, {
          children: jsx(_components.pre, {
            className: "shiki shiki-themes github-light github-dark",
            style: {
              "--shiki-light": "#24292e",
              "--shiki-dark": "#e1e4e8",
              "--shiki-light-bg": "#fff",
              "--shiki-dark-bg": "#24292e"
            },
            tabIndex: "0",
            icon: '<svg viewBox="0 0 24 24"><path d="m 4,4 a 1,1 0 0 0 -0.7070312,0.2929687 1,1 0 0 0 0,1.4140625 L 8.5859375,11 3.2929688,16.292969 a 1,1 0 0 0 0,1.414062 1,1 0 0 0 1.4140624,0 l 5.9999998,-6 a 1.0001,1.0001 0 0 0 0,-1.414062 L 4.7070312,4.2929687 A 1,1 0 0 0 4,4 Z m 8,14 a 1,1 0 0 0 -1,1 1,1 0 0 0 1,1 h 8 a 1,1 0 0 0 1,-1 1,1 0 0 0 -1,-1 z" fill="currentColor" /></svg>',
            children: jsx(_components.code, {
              children: jsxs(_components.span, {
                className: "line",
                children: [jsx(_components.span, {
                  style: {
                    "--shiki-light": "#6F42C1",
                    "--shiki-dark": "#B392F0"
                  },
                  children: "yarn"
                }), jsx(_components.span, {
                  style: {
                    "--shiki-light": "#032F62",
                    "--shiki-dark": "#9ECBFF"
                  },
                  children: " add"
                }), jsx(_components.span, {
                  style: {
                    "--shiki-light": "#032F62",
                    "--shiki-dark": "#9ECBFF"
                  },
                  children: " fumadocs-core"
                }), jsx(_components.span, {
                  style: {
                    "--shiki-light": "#032F62",
                    "--shiki-dark": "#9ECBFF"
                  },
                  children: " fumadocs-ui"
                })]
              })
            })
          })
        })
      }), jsx(CodeBlockTab, {
        value: "bun",
        children: jsx(Fragment, {
          children: jsx(_components.pre, {
            className: "shiki shiki-themes github-light github-dark",
            style: {
              "--shiki-light": "#24292e",
              "--shiki-dark": "#e1e4e8",
              "--shiki-light-bg": "#fff",
              "--shiki-dark-bg": "#24292e"
            },
            tabIndex: "0",
            icon: '<svg viewBox="0 0 24 24"><path d="m 4,4 a 1,1 0 0 0 -0.7070312,0.2929687 1,1 0 0 0 0,1.4140625 L 8.5859375,11 3.2929688,16.292969 a 1,1 0 0 0 0,1.414062 1,1 0 0 0 1.4140624,0 l 5.9999998,-6 a 1.0001,1.0001 0 0 0 0,-1.414062 L 4.7070312,4.2929687 A 1,1 0 0 0 4,4 Z m 8,14 a 1,1 0 0 0 -1,1 1,1 0 0 0 1,1 h 8 a 1,1 0 0 0 1,-1 1,1 0 0 0 -1,-1 z" fill="currentColor" /></svg>',
            children: jsx(_components.code, {
              children: jsxs(_components.span, {
                className: "line",
                children: [jsx(_components.span, {
                  style: {
                    "--shiki-light": "#6F42C1",
                    "--shiki-dark": "#B392F0"
                  },
                  children: "bun"
                }), jsx(_components.span, {
                  style: {
                    "--shiki-light": "#032F62",
                    "--shiki-dark": "#9ECBFF"
                  },
                  children: " add"
                }), jsx(_components.span, {
                  style: {
                    "--shiki-light": "#032F62",
                    "--shiki-dark": "#9ECBFF"
                  },
                  children: " fumadocs-core"
                }), jsx(_components.span, {
                  style: {
                    "--shiki-light": "#032F62",
                    "--shiki-dark": "#9ECBFF"
                  },
                  children: " fumadocs-ui"
                })]
              })
            })
          })
        })
      })]
    })]
  });
}
function MDXContent(props = {}) {
  const { wrapper: MDXLayout } = props.components || {};
  return MDXLayout ? jsx(MDXLayout, {
    ...props,
    children: jsx(_createMdxContent, {
      ...props
    })
  }) : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected component `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
const __vite_glob_1_1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  _markdown,
  default: MDXContent,
  frontmatter,
  structuredData,
  toc
}, Symbol.toStringTag, { value: "Module" }));
const create = server({ "doc": { "passthroughs": ["extractedReferences"] } });
const docs = await create.docs("docs", "content/docs", /* @__PURE__ */ Object.assign({}), /* @__PURE__ */ Object.assign({
  "./index.mdx": __vite_glob_1_0,
  "./test.mdx": __vite_glob_1_1
}));
const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
  plugins: [lucideIconsPlugin()]
});
async function getLLMText(page) {
  const processed = await page.data.getText("processed");
  return `# ${page.data.title}

${processed}`;
}
async function sha1Hash(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}
const getStaticCacheUrl = async (opts) => {
  const filename = await sha1Hash(`${opts.functionId}__${opts.hash}`);
  return `/__tsr/staticServerFnCache/${filename}.json`;
};
const jsonToFilenameSafeString = (json) => {
  const sortedKeysReplacer = (key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort().reduce((acc, curr) => {
    acc[curr] = value[curr];
    return acc;
  }, {}) : value;
  const jsonString = JSON.stringify(json ?? "", sortedKeysReplacer);
  return jsonString.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_");
};
const staticClientCache = typeof document !== "undefined" ? /* @__PURE__ */ new Map() : null;
async function addItemToCache({
  functionId,
  data,
  response
}) {
  {
    const hash = jsonToFilenameSafeString(data);
    const url = await getStaticCacheUrl({ functionId, hash });
    const clientUrl = "dist/client";
    const filePath = minpath.join(clientUrl, url);
    await fs.mkdir(minpath.dirname(filePath), { recursive: true });
    const stringifiedResult = JSON.stringify(
      await Au(
        {
          result: response.result,
          context: response.context.sendContext
        },
        { plugins: getDefaultSerovalPlugins() }
      )
    );
    await fs.writeFile(filePath, stringifiedResult, "utf-8");
  }
}
const fetchItem = async ({
  data,
  functionId
}) => {
  const hash = jsonToFilenameSafeString(data);
  const url = await getStaticCacheUrl({ functionId, hash });
  let result = staticClientCache?.get(url);
  result = await fetch(url, {
    method: "GET"
  }).then((r) => r.json()).then((d) => Iu(d, { plugins: getDefaultSerovalPlugins() }));
  return result;
};
const staticFunctionMiddleware = createMiddleware({ type: "function" }).client(async (ctx) => {
  if (
    // do not run this during SSR on the server
    typeof document !== "undefined"
  ) {
    const response = await fetchItem({
      functionId: ctx.serverFnMeta.id,
      data: ctx.data
    });
    if (response) {
      return {
        result: response.result,
        context: { ...ctx.context, ...response.context }
      };
    }
  }
  return ctx.next();
}).server(async (ctx) => {
  const response = await ctx.next();
  {
    await addItemToCache({
      functionId: ctx.serverFnMeta.id,
      response: { result: response.result, context: ctx },
      data: ctx.data
    });
  }
  return response;
});
export {
  __vite_glob_1_0 as _,
  staticFunctionMiddleware as a,
  basename as b,
  __vite_glob_1_1 as c,
  extname as e,
  findPath as f,
  getLLMText as g,
  normalizeUrl as n,
  source as s,
  visit as v
};
