import { M as useI18n, N as useDocsSearch, O as useOnChange, P as SearchDialog, Q as SearchDialogOverlay, U as SearchDialogContent, V as SearchDialogHeader, W as SearchDialogIcon, X as SearchDialogInput, Y as SearchDialogClose, Z as SearchDialogList, _ as SearchDialogFooter, $ as TagsList, a0 as TagsListItem } from "./router-D7FYOjNa.js";
import { useState, useMemo } from "react";
import { jsxs, jsx } from "react/jsx-runtime";
import "@tanstack/react-router";
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
function DefaultSearchDialog({ defaultTag, tags = [], api, delayMs, type = "fetch", allowClear = false, links = [], footer, ...props }) {
  const { locale } = useI18n();
  const [tag, setTag] = useState(defaultTag);
  const { search, setSearch, query } = useDocsSearch(type === "fetch" ? {
    type: "fetch",
    api,
    locale,
    tag,
    delayMs
  } : {
    type: "static",
    from: api,
    locale,
    tag,
    delayMs
  });
  const defaultItems = useMemo(() => {
    if (links.length === 0) return null;
    return links.map(([name, link]) => ({
      type: "page",
      id: name,
      content: name,
      url: link
    }));
  }, [links]);
  useOnChange(defaultTag, (v) => {
    setTag(v);
  });
  return /* @__PURE__ */ jsxs(SearchDialog, {
    search,
    onSearchChange: setSearch,
    isLoading: query.isLoading,
    ...props,
    children: [
      /* @__PURE__ */ jsx(SearchDialogOverlay, {}),
      /* @__PURE__ */ jsxs(SearchDialogContent, { children: [/* @__PURE__ */ jsxs(SearchDialogHeader, { children: [
        /* @__PURE__ */ jsx(SearchDialogIcon, {}),
        /* @__PURE__ */ jsx(SearchDialogInput, {}),
        /* @__PURE__ */ jsx(SearchDialogClose, {})
      ] }), /* @__PURE__ */ jsx(SearchDialogList, { items: query.data !== "empty" ? query.data : defaultItems })] }),
      /* @__PURE__ */ jsxs(SearchDialogFooter, { children: [tags.length > 0 && /* @__PURE__ */ jsx(TagsList, {
        tag,
        onTagChange: setTag,
        allowClear,
        children: tags.map((tag2) => /* @__PURE__ */ jsx(TagsListItem, {
          value: tag2.value,
          children: tag2.name
        }, tag2.value))
      }), footer] })
    ]
  });
}
export {
  DefaultSearchDialog as default
};
