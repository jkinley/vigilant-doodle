import { T as TSS_SERVER_FUNCTION, c as createServerFn } from "../server.js";
import { notFound } from "@tanstack/react-router";
import { a as staticFunctionMiddleware, s as source } from "./staticFunctionMiddleware-CI9mJ18H.js";
import "node:async_hooks";
import "srvx";
import "react/jsx-runtime";
import "@tanstack/react-router/ssr/server";
import "node:path";
import "react";
import "lucide-react";
import "fumadocs-mdx/runtime/server";
import "node:fs/promises";
const createServerRpc = (serverFnMeta, splitImportFn) => {
  const url = "/_serverFn/" + serverFnMeta.id;
  return Object.assign(splitImportFn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true
  });
};
const loader_createServerFn_handler = createServerRpc({
  id: "3dffc64eabe29fc8f5f4021f5e1cdf4bfea9319ffba3a59848ead9dcd2fa0308",
  name: "loader",
  filename: "src/routes/docs/$.tsx"
}, (opts) => loader.__executeServer(opts));
const loader = createServerFn({
  method: "GET"
}).inputValidator((slugs) => slugs).middleware([staticFunctionMiddleware]).handler(loader_createServerFn_handler, async ({
  data: slugs
}) => {
  const page = source.getPage(slugs);
  if (!page) throw notFound();
  return {
    slugs: page.slugs,
    path: page.path,
    pageTree: await source.serializePageTree(source.getPageTree())
  };
});
export {
  loader_createServerFn_handler
};
