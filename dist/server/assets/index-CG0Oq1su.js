import { jsx, jsxs } from "react/jsx-runtime";
import { Link } from "@tanstack/react-router";
import { H as HomeLayout, b as baseOptions } from "./router-D7FYOjNa.js";
import "react";
import "tailwind-merge";
import "lucide-react";
import "react-dom";
import "node:process";
import "node:path";
import "node:url";
import "@orama/orama";
import "./staticFunctionMiddleware-CI9mJ18H.js";
import "fumadocs-mdx/runtime/server";
import "node:fs/promises";
import "../server.js";
import "node:async_hooks";
import "srvx";
import "@tanstack/react-router/ssr/server";
import "fumadocs-mdx/runtime/browser";
function Home() {
  return /* @__PURE__ */ jsx(HomeLayout, { ...baseOptions(), children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center text-center flex-1", children: [
    /* @__PURE__ */ jsx("h1", { className: "font-medium text-xl mb-4", children: "Fumadocs on Tanstack Start." }),
    /* @__PURE__ */ jsx(Link, { to: "/docs/$", params: {
      _splat: ""
    }, className: "px-3 py-2 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium text-sm mx-auto", children: "Open Docs" })
  ] }) });
}
export {
  Home as component
};
