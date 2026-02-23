import { a3 as searchSimple, a4 as searchAdvanced } from "./router-D7FYOjNa.js";
import { create, load } from "@orama/orama";
import "@tanstack/react-router";
import "react/jsx-runtime";
import "react";
import "tailwind-merge";
import "lucide-react";
import "react-dom";
import "node:process";
import "node:path";
import "node:url";
import "./staticFunctionMiddleware-CI9mJ18H.js";
import "fumadocs-mdx/runtime/server";
import "node:fs/promises";
import "../server.js";
import "node:async_hooks";
import "srvx";
import "@tanstack/react-router/ssr/server";
import "fumadocs-mdx/runtime/browser";
const cache = /* @__PURE__ */ new Map();
async function loadDB({ from = "/api/search", initOrama = (locale) => create({
  schema: { _: "string" },
  language: locale
}) }) {
  const cacheKey = from;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  async function init() {
    const res = await fetch(from);
    if (!res.ok) throw new Error(`failed to fetch exported search indexes from ${from}, make sure the search database is exported and available for client.`);
    const data = await res.json();
    const dbs = /* @__PURE__ */ new Map();
    if (data.type === "i18n") {
      await Promise.all(Object.entries(data.data).map(async ([k, v]) => {
        const db2 = await initOrama(k);
        load(db2, v);
        dbs.set(k, {
          type: v.type,
          db: db2
        });
      }));
      return dbs;
    }
    const db = await initOrama();
    load(db, data);
    dbs.set("", {
      type: data.type,
      db
    });
    return dbs;
  }
  const result = init();
  cache.set(cacheKey, result);
  return result;
}
async function search(query, options) {
  const { tag, locale } = options;
  const db = (await loadDB(options)).get(locale ?? "");
  if (!db) return [];
  if (db.type === "simple") return searchSimple(db, query);
  return searchAdvanced(db.db, query, tag);
}
export {
  search
};
