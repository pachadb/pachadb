// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (modules, entry, mainEntry, parcelRequireName, globalName) {
  /* eslint-disable no-undef */
  var globalObject =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  /* eslint-enable no-undef */

  // Save the require from previous bundle to this closure if any
  var previousRequire =
    typeof globalObject[parcelRequireName] === 'function' &&
    globalObject[parcelRequireName];

  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire =
          typeof globalObject[parcelRequireName] === 'function' &&
          globalObject[parcelRequireName];
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        this
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      var res = localRequire.resolve(x);
      return res === false ? {} : newRequire(res);
    }

    function resolve(x) {
      var id = modules[name][1][x];
      return id != null ? id : x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  Object.defineProperty(newRequire, 'root', {
    get: function () {
      return globalObject[parcelRequireName];
    },
  });

  globalObject[parcelRequireName] = newRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (mainEntry) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(mainEntry);

    // CommonJS
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = mainExports;

      // RequireJS
    } else if (typeof define === 'function' && define.amd) {
      define(function () {
        return mainExports;
      });

      // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }
})({"2z5ev":[function(require,module,exports) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SECURE = false;
var HMR_ENV_HASH = "d6ea1d42532a7575";
module.bundle.HMR_BUNDLE_ID = "78fcd0ac8e9bd240";
"use strict";
/* global HMR_HOST, HMR_PORT, HMR_ENV_HASH, HMR_SECURE, chrome, browser, __parcel__import__, __parcel__importScripts__, ServiceWorkerGlobalScope */ /*::
import type {
  HMRAsset,
  HMRMessage,
} from '@parcel/reporter-dev-server/src/HMRServer.js';
interface ParcelRequire {
  (string): mixed;
  cache: {|[string]: ParcelModule|};
  hotData: {|[string]: mixed|};
  Module: any;
  parent: ?ParcelRequire;
  isParcelRequire: true;
  modules: {|[string]: [Function, {|[string]: string|}]|};
  HMR_BUNDLE_ID: string;
  root: ParcelRequire;
}
interface ParcelModule {
  hot: {|
    data: mixed,
    accept(cb: (Function) => void): void,
    dispose(cb: (mixed) => void): void,
    // accept(deps: Array<string> | string, cb: (Function) => void): void,
    // decline(): void,
    _acceptCallbacks: Array<(Function) => void>,
    _disposeCallbacks: Array<(mixed) => void>,
  |};
}
interface ExtensionContext {
  runtime: {|
    reload(): void,
    getURL(url: string): string;
    getManifest(): {manifest_version: number, ...};
  |};
}
declare var module: {bundle: ParcelRequire, ...};
declare var HMR_HOST: string;
declare var HMR_PORT: string;
declare var HMR_ENV_HASH: string;
declare var HMR_SECURE: boolean;
declare var chrome: ExtensionContext;
declare var browser: ExtensionContext;
declare var __parcel__import__: (string) => Promise<void>;
declare var __parcel__importScripts__: (string) => Promise<void>;
declare var globalThis: typeof self;
declare var ServiceWorkerGlobalScope: Object;
*/ var OVERLAY_ID = "__parcel__error__overlay__";
var OldModule = module.bundle.Module;
function Module(moduleName) {
    OldModule.call(this, moduleName);
    this.hot = {
        data: module.bundle.hotData[moduleName],
        _acceptCallbacks: [],
        _disposeCallbacks: [],
        accept: function(fn) {
            this._acceptCallbacks.push(fn || function() {});
        },
        dispose: function(fn) {
            this._disposeCallbacks.push(fn);
        }
    };
    module.bundle.hotData[moduleName] = undefined;
}
module.bundle.Module = Module;
module.bundle.hotData = {};
var checkedAssets /*: {|[string]: boolean|} */ , assetsToDispose /*: Array<[ParcelRequire, string]> */ , assetsToAccept /*: Array<[ParcelRequire, string]> */ ;
function getHostname() {
    return HMR_HOST || (location.protocol.indexOf("http") === 0 ? location.hostname : "localhost");
}
function getPort() {
    return HMR_PORT || location.port;
}
// eslint-disable-next-line no-redeclare
var parent = module.bundle.parent;
if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== "undefined") {
    var hostname = getHostname();
    var port = getPort();
    var protocol = HMR_SECURE || location.protocol == "https:" && !/localhost|127.0.0.1|0.0.0.0/.test(hostname) ? "wss" : "ws";
    var ws = new WebSocket(protocol + "://" + hostname + (port ? ":" + port : "") + "/");
    // Web extension context
    var extCtx = typeof chrome === "undefined" ? typeof browser === "undefined" ? null : browser : chrome;
    // Safari doesn't support sourceURL in error stacks.
    // eval may also be disabled via CSP, so do a quick check.
    var supportsSourceURL = false;
    try {
        (0, eval)('throw new Error("test"); //# sourceURL=test.js');
    } catch (err) {
        supportsSourceURL = err.stack.includes("test.js");
    }
    // $FlowFixMe
    ws.onmessage = async function(event /*: {data: string, ...} */ ) {
        checkedAssets = {} /*: {|[string]: boolean|} */ ;
        assetsToAccept = [];
        assetsToDispose = [];
        var data /*: HMRMessage */  = JSON.parse(event.data);
        if (data.type === "update") {
            // Remove error overlay if there is one
            if (typeof document !== "undefined") removeErrorOverlay();
            let assets = data.assets.filter((asset)=>asset.envHash === HMR_ENV_HASH);
            // Handle HMR Update
            let handled = assets.every((asset)=>{
                return asset.type === "css" || asset.type === "js" && hmrAcceptCheck(module.bundle.root, asset.id, asset.depsByBundle);
            });
            if (handled) {
                console.clear();
                // Dispatch custom event so other runtimes (e.g React Refresh) are aware.
                if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") window.dispatchEvent(new CustomEvent("parcelhmraccept"));
                await hmrApplyUpdates(assets);
                // Dispose all old assets.
                let processedAssets = {} /*: {|[string]: boolean|} */ ;
                for(let i = 0; i < assetsToDispose.length; i++){
                    let id = assetsToDispose[i][1];
                    if (!processedAssets[id]) {
                        hmrDispose(assetsToDispose[i][0], id);
                        processedAssets[id] = true;
                    }
                }
                // Run accept callbacks. This will also re-execute other disposed assets in topological order.
                processedAssets = {};
                for(let i = 0; i < assetsToAccept.length; i++){
                    let id = assetsToAccept[i][1];
                    if (!processedAssets[id]) {
                        hmrAccept(assetsToAccept[i][0], id);
                        processedAssets[id] = true;
                    }
                }
            } else fullReload();
        }
        if (data.type === "error") {
            // Log parcel errors to console
            for (let ansiDiagnostic of data.diagnostics.ansi){
                let stack = ansiDiagnostic.codeframe ? ansiDiagnostic.codeframe : ansiDiagnostic.stack;
                console.error("\uD83D\uDEA8 [parcel]: " + ansiDiagnostic.message + "\n" + stack + "\n\n" + ansiDiagnostic.hints.join("\n"));
            }
            if (typeof document !== "undefined") {
                // Render the fancy html overlay
                removeErrorOverlay();
                var overlay = createErrorOverlay(data.diagnostics.html);
                // $FlowFixMe
                document.body.appendChild(overlay);
            }
        }
    };
    ws.onerror = function(e) {
        console.error(e.message);
    };
    ws.onclose = function() {
        console.warn("[parcel] \uD83D\uDEA8 Connection to the HMR server was lost");
    };
}
function removeErrorOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.remove();
        console.log("[parcel] ✨ Error resolved");
    }
}
function createErrorOverlay(diagnostics) {
    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    let errorHTML = '<div style="background: black; opacity: 0.85; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; font-family: Menlo, Consolas, monospace; z-index: 9999;">';
    for (let diagnostic of diagnostics){
        let stack = diagnostic.frames.length ? diagnostic.frames.reduce((p, frame)=>{
            return `${p}
<a href="/__parcel_launch_editor?file=${encodeURIComponent(frame.location)}" style="text-decoration: underline; color: #888" onclick="fetch(this.href); return false">${frame.location}</a>
${frame.code}`;
        }, "") : diagnostic.stack;
        errorHTML += `
      <div>
        <div style="font-size: 18px; font-weight: bold; margin-top: 20px;">
          🚨 ${diagnostic.message}
        </div>
        <pre>${stack}</pre>
        <div>
          ${diagnostic.hints.map((hint)=>"<div>\uD83D\uDCA1 " + hint + "</div>").join("")}
        </div>
        ${diagnostic.documentation ? `<div>📝 <a style="color: violet" href="${diagnostic.documentation}" target="_blank">Learn more</a></div>` : ""}
      </div>
    `;
    }
    errorHTML += "</div>";
    overlay.innerHTML = errorHTML;
    return overlay;
}
function fullReload() {
    if ("reload" in location) location.reload();
    else if (extCtx && extCtx.runtime && extCtx.runtime.reload) extCtx.runtime.reload();
}
function getParents(bundle, id) /*: Array<[ParcelRequire, string]> */ {
    var modules = bundle.modules;
    if (!modules) return [];
    var parents = [];
    var k, d, dep;
    for(k in modules)for(d in modules[k][1]){
        dep = modules[k][1][d];
        if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) parents.push([
            bundle,
            k
        ]);
    }
    if (bundle.parent) parents = parents.concat(getParents(bundle.parent, id));
    return parents;
}
function updateLink(link) {
    var href = link.getAttribute("href");
    if (!href) return;
    var newLink = link.cloneNode();
    newLink.onload = function() {
        if (link.parentNode !== null) // $FlowFixMe
        link.parentNode.removeChild(link);
    };
    newLink.setAttribute("href", // $FlowFixMe
    href.split("?")[0] + "?" + Date.now());
    // $FlowFixMe
    link.parentNode.insertBefore(newLink, link.nextSibling);
}
var cssTimeout = null;
function reloadCSS() {
    if (cssTimeout) return;
    cssTimeout = setTimeout(function() {
        var links = document.querySelectorAll('link[rel="stylesheet"]');
        for(var i = 0; i < links.length; i++){
            // $FlowFixMe[incompatible-type]
            var href /*: string */  = links[i].getAttribute("href");
            var hostname = getHostname();
            var servedFromHMRServer = hostname === "localhost" ? new RegExp("^(https?:\\/\\/(0.0.0.0|127.0.0.1)|localhost):" + getPort()).test(href) : href.indexOf(hostname + ":" + getPort());
            var absolute = /^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0 && !servedFromHMRServer;
            if (!absolute) updateLink(links[i]);
        }
        cssTimeout = null;
    }, 50);
}
function hmrDownload(asset) {
    if (asset.type === "js") {
        if (typeof document !== "undefined") {
            let script = document.createElement("script");
            script.src = asset.url + "?t=" + Date.now();
            if (asset.outputFormat === "esmodule") script.type = "module";
            return new Promise((resolve, reject)=>{
                var _document$head;
                script.onload = ()=>resolve(script);
                script.onerror = reject;
                (_document$head = document.head) === null || _document$head === void 0 || _document$head.appendChild(script);
            });
        } else if (typeof importScripts === "function") {
            // Worker scripts
            if (asset.outputFormat === "esmodule") return import(asset.url + "?t=" + Date.now());
            else return new Promise((resolve, reject)=>{
                try {
                    importScripts(asset.url + "?t=" + Date.now());
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        }
    }
}
async function hmrApplyUpdates(assets) {
    global.parcelHotUpdate = Object.create(null);
    let scriptsToRemove;
    try {
        // If sourceURL comments aren't supported in eval, we need to load
        // the update from the dev server over HTTP so that stack traces
        // are correct in errors/logs. This is much slower than eval, so
        // we only do it if needed (currently just Safari).
        // https://bugs.webkit.org/show_bug.cgi?id=137297
        // This path is also taken if a CSP disallows eval.
        if (!supportsSourceURL) {
            let promises = assets.map((asset)=>{
                var _hmrDownload;
                return (_hmrDownload = hmrDownload(asset)) === null || _hmrDownload === void 0 ? void 0 : _hmrDownload.catch((err)=>{
                    // Web extension bugfix for Chromium
                    // https://bugs.chromium.org/p/chromium/issues/detail?id=1255412#c12
                    if (extCtx && extCtx.runtime && extCtx.runtime.getManifest().manifest_version == 3) {
                        if (typeof ServiceWorkerGlobalScope != "undefined" && global instanceof ServiceWorkerGlobalScope) {
                            extCtx.runtime.reload();
                            return;
                        }
                        asset.url = extCtx.runtime.getURL("/__parcel_hmr_proxy__?url=" + encodeURIComponent(asset.url + "?t=" + Date.now()));
                        return hmrDownload(asset);
                    }
                    throw err;
                });
            });
            scriptsToRemove = await Promise.all(promises);
        }
        assets.forEach(function(asset) {
            hmrApply(module.bundle.root, asset);
        });
    } finally{
        delete global.parcelHotUpdate;
        if (scriptsToRemove) scriptsToRemove.forEach((script)=>{
            if (script) {
                var _document$head2;
                (_document$head2 = document.head) === null || _document$head2 === void 0 || _document$head2.removeChild(script);
            }
        });
    }
}
function hmrApply(bundle /*: ParcelRequire */ , asset /*:  HMRAsset */ ) {
    var modules = bundle.modules;
    if (!modules) return;
    if (asset.type === "css") reloadCSS();
    else if (asset.type === "js") {
        let deps = asset.depsByBundle[bundle.HMR_BUNDLE_ID];
        if (deps) {
            if (modules[asset.id]) {
                // Remove dependencies that are removed and will become orphaned.
                // This is necessary so that if the asset is added back again, the cache is gone, and we prevent a full page reload.
                let oldDeps = modules[asset.id][1];
                for(let dep in oldDeps)if (!deps[dep] || deps[dep] !== oldDeps[dep]) {
                    let id = oldDeps[dep];
                    let parents = getParents(module.bundle.root, id);
                    if (parents.length === 1) hmrDelete(module.bundle.root, id);
                }
            }
            if (supportsSourceURL) // Global eval. We would use `new Function` here but browser
            // support for source maps is better with eval.
            (0, eval)(asset.output);
            // $FlowFixMe
            let fn = global.parcelHotUpdate[asset.id];
            modules[asset.id] = [
                fn,
                deps
            ];
        } else if (bundle.parent) hmrApply(bundle.parent, asset);
    }
}
function hmrDelete(bundle, id) {
    let modules = bundle.modules;
    if (!modules) return;
    if (modules[id]) {
        // Collect dependencies that will become orphaned when this module is deleted.
        let deps = modules[id][1];
        let orphans = [];
        for(let dep in deps){
            let parents = getParents(module.bundle.root, deps[dep]);
            if (parents.length === 1) orphans.push(deps[dep]);
        }
        // Delete the module. This must be done before deleting dependencies in case of circular dependencies.
        delete modules[id];
        delete bundle.cache[id];
        // Now delete the orphans.
        orphans.forEach((id)=>{
            hmrDelete(module.bundle.root, id);
        });
    } else if (bundle.parent) hmrDelete(bundle.parent, id);
}
function hmrAcceptCheck(bundle /*: ParcelRequire */ , id /*: string */ , depsByBundle /*: ?{ [string]: { [string]: string } }*/ ) {
    if (hmrAcceptCheckOne(bundle, id, depsByBundle)) return true;
    // Traverse parents breadth first. All possible ancestries must accept the HMR update, or we'll reload.
    let parents = getParents(module.bundle.root, id);
    let accepted = false;
    while(parents.length > 0){
        let v = parents.shift();
        let a = hmrAcceptCheckOne(v[0], v[1], null);
        if (a) // If this parent accepts, stop traversing upward, but still consider siblings.
        accepted = true;
        else {
            // Otherwise, queue the parents in the next level upward.
            let p = getParents(module.bundle.root, v[1]);
            if (p.length === 0) {
                // If there are no parents, then we've reached an entry without accepting. Reload.
                accepted = false;
                break;
            }
            parents.push(...p);
        }
    }
    return accepted;
}
function hmrAcceptCheckOne(bundle /*: ParcelRequire */ , id /*: string */ , depsByBundle /*: ?{ [string]: { [string]: string } }*/ ) {
    var modules = bundle.modules;
    if (!modules) return;
    if (depsByBundle && !depsByBundle[bundle.HMR_BUNDLE_ID]) {
        // If we reached the root bundle without finding where the asset should go,
        // there's nothing to do. Mark as "accepted" so we don't reload the page.
        if (!bundle.parent) return true;
        return hmrAcceptCheck(bundle.parent, id, depsByBundle);
    }
    if (checkedAssets[id]) return true;
    checkedAssets[id] = true;
    var cached = bundle.cache[id];
    assetsToDispose.push([
        bundle,
        id
    ]);
    if (!cached || cached.hot && cached.hot._acceptCallbacks.length) {
        assetsToAccept.push([
            bundle,
            id
        ]);
        return true;
    }
}
function hmrDispose(bundle /*: ParcelRequire */ , id /*: string */ ) {
    var cached = bundle.cache[id];
    bundle.hotData[id] = {};
    if (cached && cached.hot) cached.hot.data = bundle.hotData[id];
    if (cached && cached.hot && cached.hot._disposeCallbacks.length) cached.hot._disposeCallbacks.forEach(function(cb) {
        cb(bundle.hotData[id]);
    });
    delete bundle.cache[id];
}
function hmrAccept(bundle /*: ParcelRequire */ , id /*: string */ ) {
    // Execute the module.
    bundle(id);
    // Run the accept callbacks in the new version of the module.
    var cached = bundle.cache[id];
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) cached.hot._acceptCallbacks.forEach(function(cb) {
        var assetsToAlsoAccept = cb(function() {
            return getParents(module.bundle.root, id);
        });
        if (assetsToAlsoAccept && assetsToAccept.length) {
            assetsToAlsoAccept.forEach(function(a) {
                hmrDispose(a[0], a[1]);
            });
            // $FlowFixMe[method-unbinding]
            assetsToAccept.push.apply(assetsToAccept, assetsToAlsoAccept);
        }
    });
}

},{}],"1jwFz":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
var _pachadbCoreWasm = require("pachadb-core-wasm");
var _pachadbCoreWasmDefault = parcelHelpers.interopDefault(_pachadbCoreWasm);
let boot = async ()=>{
    await (0, _pachadbCoreWasmDefault.default)();
    console.log(_pachadbCoreWasm);
    let db = new _pachadbCoreWasm.Client();
    let luke = _pachadbCoreWasm.Value.uri(new _pachadbCoreWasm.Uri("luke"));
    let anakin = _pachadbCoreWasm.Value.uri(new _pachadbCoreWasm.Uri("anakin"));
    let ahsoka = _pachadbCoreWasm.Value.uri(new _pachadbCoreWasm.Uri("ahsoka"));
    await db.state([
        {
            entity: "obiwan",
            field: "master-of",
            value: anakin,
            source: "test"
        },
        {
            entity: "anakin",
            field: "master-of",
            value: ahsoka,
            source: "test"
        }
    ]);
    await db.state([
        {
            entity: "obiwan",
            field: "master-of",
            value: luke,
            source: "test"
        }
    ]);
    let result = await db.query("(?who master-of ?pupil)");
    console.log(result);
    window.Pacha = _pachadbCoreWasm;
    window.db = db;
};
boot();

},{"pachadb-core-wasm":"jY7Nm","@parcel/transformer-js/src/esmodule-helpers.js":"dJv3G"}],"jY7Nm":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "ValueTag", ()=>ValueTag);
/**
*/ parcelHelpers.export(exports, "Client", ()=>Client);
/**
*/ parcelHelpers.export(exports, "DateTime", ()=>DateTime);
/**
*/ parcelHelpers.export(exports, "Fact", ()=>Fact);
/**
*/ parcelHelpers.export(exports, "TxId", ()=>TxId);
/**
*/ parcelHelpers.export(exports, "Uri", ()=>Uri);
/**
*/ parcelHelpers.export(exports, "UserFact", ()=>UserFact);
/**
*/ parcelHelpers.export(exports, "Value", ()=>Value);
parcelHelpers.export(exports, "initSync", ()=>initSync);
var global = arguments[3];
let wasm;
const heap = new Array(128).fill(undefined);
heap.push(undefined, null, true, false);
function getObject(idx) {
    return heap[idx];
}
let heap_next = heap.length;
function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}
function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}
let WASM_VECTOR_LEN = 0;
let cachedUint8Memory0 = null;
function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    return cachedUint8Memory0;
}
const cachedTextEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder("utf-8") : {
    encode: ()=>{
        throw Error("TextEncoder not available");
    }
};
const encodeString = typeof cachedTextEncoder.encodeInto === "function" ? function(arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
} : function(arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
};
function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }
    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;
    const mem = getUint8Memory0();
    let offset = 0;
    for(; offset < len; offset++){
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) arg = arg.slice(offset);
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);
        offset += ret.written;
    }
    WASM_VECTOR_LEN = offset;
    return ptr;
}
function isLikeNone(x) {
    return x === undefined || x === null;
}
let cachedInt32Memory0 = null;
function getInt32Memory0() {
    if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
    return cachedInt32Memory0;
}
const cachedTextDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", {
    ignoreBOM: true,
    fatal: true
}) : {
    decode: ()=>{
        throw Error("TextDecoder not available");
    }
};
if (typeof TextDecoder !== "undefined") cachedTextDecoder.decode();
function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}
function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];
    heap[idx] = obj;
    return idx;
}
let cachedFloat64Memory0 = null;
function getFloat64Memory0() {
    if (cachedFloat64Memory0 === null || cachedFloat64Memory0.byteLength === 0) cachedFloat64Memory0 = new Float64Array(wasm.memory.buffer);
    return cachedFloat64Memory0;
}
function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == "number" || type == "boolean" || val == null) return `${val}`;
    if (type == "string") return `"${val}"`;
    if (type == "symbol") {
        const description = val.description;
        if (description == null) return "Symbol";
        else return `Symbol(${description})`;
    }
    if (type == "function") {
        const name = val.name;
        if (typeof name == "string" && name.length > 0) return `Function(${name})`;
        else return "Function";
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = "[";
        if (length > 0) debug += debugString(val[0]);
        for(let i = 1; i < length; i++)debug += ", " + debugString(val[i]);
        debug += "]";
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches.length > 1) className = builtInMatches[1];
    else // Failed to match the standard '[object ClassName]'
    return toString.call(val);
    if (className == "Object") // we're a user defined class or Object
    // JSON.stringify avoids problems with cycles, and is generally much
    // easier than looping through ownProperties of `val`.
    try {
        return "Object(" + JSON.stringify(val) + ")";
    } catch (_) {
        return "Object";
    }
    // errors
    if (val instanceof Error) return `${val.name}: ${val.message}\n${val.stack}`;
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}
function makeMutClosure(arg0, arg1, dtor, f) {
    const state = {
        a: arg0,
        b: arg1,
        cnt: 1,
        dtor
    };
    const real = (...args)=>{
        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally{
            if (--state.cnt === 0) wasm.__wbindgen_export_2.get(state.dtor)(a, state.b);
            else state.a = a;
        }
    };
    real.original = state;
    return real;
}
function __wbg_adapter_36(arg0, arg1, arg2) {
    wasm._dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hb3ef1d8f55823b45(arg0, arg1, addHeapObject(arg2));
}
function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) throw new Error(`expected instance of ${klass.name}`);
    return instance.ptr;
}
function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm.__wbindgen_exn_store(addHeapObject(e));
    }
}
function __wbg_adapter_152(arg0, arg1, arg2, arg3) {
    wasm.wasm_bindgen__convert__closures__invoke2_mut__h0132eab8597e51d7(arg0, arg1, addHeapObject(arg2), addHeapObject(arg3));
}
const ValueTag = Object.freeze({
    Unknown: 0,
    "0": "Unknown",
    Uri: 1,
    "1": "Uri",
    String: 2,
    "2": "String"
});
class Client {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Client.prototype);
        obj.__wbg_ptr = ptr;
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_client_free(ptr);
    }
    /**
    */ constructor(){
        const ret = wasm.client_new();
        return Client.__wrap(ret);
    }
    /**
    * @param {any} obj
    * @returns {Promise<TxId>}
    */ state(obj) {
        const ret = wasm.client_state(this.__wbg_ptr, addHeapObject(obj));
        return takeObject(ret);
    }
    /**
    * @param {any} obj
    * @returns {Promise<any>}
    */ query(obj) {
        const ret = wasm.client_query(this.__wbg_ptr, addHeapObject(obj));
        return takeObject(ret);
    }
}
class DateTime {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(DateTime.prototype);
        obj.__wbg_ptr = ptr;
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_datetime_free(ptr);
    }
    /**
    * @returns {DateTime}
    */ static now_utc() {
        const ret = wasm.datetime_now_utc();
        return DateTime.__wrap(ret);
    }
}
class Fact {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_fact_free(ptr);
    }
    /**
    * @returns {TxId}
    */ get tx_id() {
        const ret = wasm.__wbg_get_fact_tx_id(this.__wbg_ptr);
        return TxId.__wrap(ret);
    }
    /**
    * @param {TxId} arg0
    */ set tx_id(arg0) {
        _assertClass(arg0, TxId);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_fact_tx_id(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Uri}
    */ get id() {
        const ret = wasm.__wbg_get_fact_id(this.__wbg_ptr);
        return Uri.__wrap(ret);
    }
    /**
    * @param {Uri} arg0
    */ set id(arg0) {
        _assertClass(arg0, Uri);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_fact_id(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Uri}
    */ get entity() {
        const ret = wasm.__wbg_get_fact_entity(this.__wbg_ptr);
        return Uri.__wrap(ret);
    }
    /**
    * @param {Uri} arg0
    */ set entity(arg0) {
        _assertClass(arg0, Uri);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_fact_entity(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Uri}
    */ get field() {
        const ret = wasm.__wbg_get_fact_field(this.__wbg_ptr);
        return Uri.__wrap(ret);
    }
    /**
    * @param {Uri} arg0
    */ set field(arg0) {
        _assertClass(arg0, Uri);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_fact_field(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Uri}
    */ get source() {
        const ret = wasm.__wbg_get_fact_source(this.__wbg_ptr);
        return Uri.__wrap(ret);
    }
    /**
    * @param {Uri} arg0
    */ set source(arg0) {
        _assertClass(arg0, Uri);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_fact_source(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Value}
    */ get value() {
        const ret = wasm.__wbg_get_fact_value(this.__wbg_ptr);
        return Value.__wrap(ret);
    }
    /**
    * @param {Value} arg0
    */ set value(arg0) {
        _assertClass(arg0, Value);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_fact_value(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {DateTime}
    */ get stated_at() {
        const ret = wasm.__wbg_get_fact_stated_at(this.__wbg_ptr);
        return DateTime.__wrap(ret);
    }
    /**
    * @param {DateTime} arg0
    */ set stated_at(arg0) {
        _assertClass(arg0, DateTime);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_fact_stated_at(this.__wbg_ptr, ptr0);
    }
}
class TxId {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(TxId.prototype);
        obj.__wbg_ptr = ptr;
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_txid_free(ptr);
    }
    /**
    * @returns {bigint}
    */ get 0() {
        const ret = wasm.__wbg_get_txid_0(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
    * @param {bigint} arg0
    */ set 0(arg0) {
        wasm.__wbg_set_txid_0(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {TxId}
    */ next() {
        const ret = wasm.txid_next(this.__wbg_ptr);
        return TxId.__wrap(ret);
    }
    /**
    * @returns {TxId}
    */ static max() {
        const ret = wasm.txid_max();
        return TxId.__wrap(ret);
    }
}
class Uri {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Uri.prototype);
        obj.__wbg_ptr = ptr;
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_uri_free(ptr);
    }
    /**
    * @param {string} str
    */ constructor(str){
        const ptr0 = passStringToWasm0(str, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.uri_new(ptr0, len0);
        return Uri.__wrap(ret);
    }
    /**
    * @returns {string}
    */ get 0() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_uri_0(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally{
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * @param {string} arg0
    */ set 0(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_uri_0(this.__wbg_ptr, ptr0, len0);
    }
}
class UserFact {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_userfact_free(ptr);
    }
    /**
    * @returns {Uri}
    */ get entity() {
        const ret = wasm.__wbg_get_userfact_entity(this.__wbg_ptr);
        return Uri.__wrap(ret);
    }
    /**
    * @param {Uri} arg0
    */ set entity(arg0) {
        _assertClass(arg0, Uri);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_userfact_entity(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Uri}
    */ get field() {
        const ret = wasm.__wbg_get_userfact_field(this.__wbg_ptr);
        return Uri.__wrap(ret);
    }
    /**
    * @param {Uri} arg0
    */ set field(arg0) {
        _assertClass(arg0, Uri);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_userfact_field(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Uri}
    */ get source() {
        const ret = wasm.__wbg_get_userfact_source(this.__wbg_ptr);
        return Uri.__wrap(ret);
    }
    /**
    * @param {Uri} arg0
    */ set source(arg0) {
        _assertClass(arg0, Uri);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_userfact_source(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Value}
    */ get value() {
        const ret = wasm.__wbg_get_userfact_value(this.__wbg_ptr);
        return Value.__wrap(ret);
    }
    /**
    * @param {Value} arg0
    */ set value(arg0) {
        _assertClass(arg0, Value);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_userfact_value(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {DateTime}
    */ get stated_at() {
        const ret = wasm.__wbg_get_userfact_stated_at(this.__wbg_ptr);
        return DateTime.__wrap(ret);
    }
    /**
    * @param {DateTime} arg0
    */ set stated_at(arg0) {
        _assertClass(arg0, DateTime);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_userfact_stated_at(this.__wbg_ptr, ptr0);
    }
}
class Value {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Value.prototype);
        obj.__wbg_ptr = ptr;
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_value_free(ptr);
    }
    /**
    * @param {string} str
    * @returns {Value}
    */ static string(str) {
        const ptr0 = passStringToWasm0(str, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.value_string(ptr0, len0);
        return Value.__wrap(ret);
    }
    /**
    * @param {Uri} uri
    * @returns {Value}
    */ static uri(uri) {
        _assertClass(uri, Uri);
        var ptr0 = uri.__destroy_into_raw();
        const ret = wasm.value_uri(ptr0);
        return Value.__wrap(ret);
    }
    /**
    * @returns {number}
    */ get tag() {
        const ret = wasm.value_tag(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {string}
    */ get value() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.value_value(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally{
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
async function __wbg_load(module1, imports) {
    if (typeof Response === "function" && module1 instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === "function") try {
            return await WebAssembly.instantiateStreaming(module1, imports);
        } catch (e) {
            if (module1.headers.get("Content-Type") != "application/wasm") console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
            else throw e;
        }
        const bytes = await module1.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module1, imports);
        if (instance instanceof WebAssembly.Instance) return {
            instance,
            module: module1
        };
        else return instance;
    }
}
function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
        takeObject(arg0);
    };
    imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
        const obj = getObject(arg1);
        const ret = typeof obj === "string" ? obj : undefined;
        var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        getInt32Memory0()[arg0 / 4 + 1] = len1;
        getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    };
    imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_is_object = function(arg0) {
        const val = getObject(arg0);
        const ret = typeof val === "object" && val !== null;
        return ret;
    };
    imports.wbg.__wbindgen_is_undefined = function(arg0) {
        const ret = getObject(arg0) === undefined;
        return ret;
    };
    imports.wbg.__wbindgen_in = function(arg0, arg1) {
        const ret = getObject(arg0) in getObject(arg1);
        return ret;
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_object_clone_ref = function(arg0) {
        const ret = getObject(arg0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_jsval_loose_eq = function(arg0, arg1) {
        const ret = getObject(arg0) == getObject(arg1);
        return ret;
    };
    imports.wbg.__wbindgen_boolean_get = function(arg0) {
        const v = getObject(arg0);
        const ret = typeof v === "boolean" ? v ? 1 : 0 : 2;
        return ret;
    };
    imports.wbg.__wbindgen_number_get = function(arg0, arg1) {
        const obj = getObject(arg1);
        const ret = typeof obj === "number" ? obj : undefined;
        getFloat64Memory0()[arg0 / 8 + 1] = isLikeNone(ret) ? 0 : ret;
        getInt32Memory0()[arg0 / 4 + 0] = !isLikeNone(ret);
    };
    imports.wbg.__wbg_getwithrefkey_5e6d9547403deab8 = function(arg0, arg1) {
        const ret = getObject(arg0)[getObject(arg1)];
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_set_841ac57cff3d672b = function(arg0, arg1, arg2) {
        getObject(arg0)[takeObject(arg1)] = takeObject(arg2);
    };
    imports.wbg.__wbindgen_cb_drop = function(arg0) {
        const obj = takeObject(arg0).original;
        if (obj.cnt-- == 1) {
            obj.a = 0;
            return true;
        }
        const ret = false;
        return ret;
    };
    imports.wbg.__wbg_debug_7960d327fd96f71a = function(arg0, arg1, arg2, arg3) {
        console.debug(getObject(arg0), getObject(arg1), getObject(arg2), getObject(arg3));
    };
    imports.wbg.__wbg_error_fe807da27c4a4ced = function(arg0) {
        console.error(getObject(arg0));
    };
    imports.wbg.__wbg_error_fd84ca2a8a977774 = function(arg0, arg1, arg2, arg3) {
        console.error(getObject(arg0), getObject(arg1), getObject(arg2), getObject(arg3));
    };
    imports.wbg.__wbg_info_5566be377f5b52ae = function(arg0, arg1, arg2, arg3) {
        console.info(getObject(arg0), getObject(arg1), getObject(arg2), getObject(arg3));
    };
    imports.wbg.__wbg_log_7b690f184ae4519b = function(arg0, arg1, arg2, arg3) {
        console.log(getObject(arg0), getObject(arg1), getObject(arg2), getObject(arg3));
    };
    imports.wbg.__wbg_warn_48cbddced45e5414 = function(arg0, arg1, arg2, arg3) {
        console.warn(getObject(arg0), getObject(arg1), getObject(arg2), getObject(arg3));
    };
    imports.wbg.__wbg_new_abda76e883ba8a5f = function() {
        const ret = new Error();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_stack_658279fe44541cf6 = function(arg0, arg1) {
        const ret = getObject(arg1).stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getInt32Memory0()[arg0 / 4 + 1] = len1;
        getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    };
    imports.wbg.__wbg_error_f851667af71bcfc6 = function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.error(getStringFromWasm0(arg0, arg1));
        } finally{
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbg_txid_new = function(arg0) {
        const ret = TxId.__wrap(arg0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_crypto_c48a774b022d20ac = function(arg0) {
        const ret = getObject(arg0).crypto;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_process_298734cf255a885d = function(arg0) {
        const ret = getObject(arg0).process;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_versions_e2e78e134e3e5d01 = function(arg0) {
        const ret = getObject(arg0).versions;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_node_1cd7a5d853dbea79 = function(arg0) {
        const ret = getObject(arg0).node;
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_is_string = function(arg0) {
        const ret = typeof getObject(arg0) === "string";
        return ret;
    };
    imports.wbg.__wbg_msCrypto_bcb970640f50a1e8 = function(arg0) {
        const ret = getObject(arg0).msCrypto;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_require_8f08ceecec0f4fee = function() {
        return handleError(function() {
            const ret = module.require;
            return addHeapObject(ret);
        }, arguments);
    };
    imports.wbg.__wbindgen_is_function = function(arg0) {
        const ret = typeof getObject(arg0) === "function";
        return ret;
    };
    imports.wbg.__wbg_getRandomValues_37fa2ca9e4e07fab = function() {
        return handleError(function(arg0, arg1) {
            getObject(arg0).getRandomValues(getObject(arg1));
        }, arguments);
    };
    imports.wbg.__wbg_randomFillSync_dc1e9a60c158336d = function() {
        return handleError(function(arg0, arg1) {
            getObject(arg0).randomFillSync(takeObject(arg1));
        }, arguments);
    };
    imports.wbg.__wbg_get_44be0491f933a435 = function(arg0, arg1) {
        const ret = getObject(arg0)[arg1 >>> 0];
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_length_fff51ee6522a1a18 = function(arg0) {
        const ret = getObject(arg0).length;
        return ret;
    };
    imports.wbg.__wbg_new_898a68150f225f2e = function() {
        const ret = new Array();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_newnoargs_581967eacc0e2604 = function(arg0, arg1) {
        const ret = new Function(getStringFromWasm0(arg0, arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_next_526fc47e980da008 = function(arg0) {
        const ret = getObject(arg0).next;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_next_ddb3312ca1c4e32a = function() {
        return handleError(function(arg0) {
            const ret = getObject(arg0).next();
            return addHeapObject(ret);
        }, arguments);
    };
    imports.wbg.__wbg_done_5c1f01fb660d73b5 = function(arg0) {
        const ret = getObject(arg0).done;
        return ret;
    };
    imports.wbg.__wbg_value_1695675138684bd5 = function(arg0) {
        const ret = getObject(arg0).value;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_iterator_97f0c81209c6c35a = function() {
        const ret = Symbol.iterator;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_get_97b561fb56f034b5 = function() {
        return handleError(function(arg0, arg1) {
            const ret = Reflect.get(getObject(arg0), getObject(arg1));
            return addHeapObject(ret);
        }, arguments);
    };
    imports.wbg.__wbg_call_cb65541d95d71282 = function() {
        return handleError(function(arg0, arg1) {
            const ret = getObject(arg0).call(getObject(arg1));
            return addHeapObject(ret);
        }, arguments);
    };
    imports.wbg.__wbg_new_b51585de1b234aff = function() {
        const ret = new Object();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_self_1ff1d729e9aae938 = function() {
        return handleError(function() {
            const ret = self.self;
            return addHeapObject(ret);
        }, arguments);
    };
    imports.wbg.__wbg_window_5f4faef6c12b79ec = function() {
        return handleError(function() {
            const ret = window.window;
            return addHeapObject(ret);
        }, arguments);
    };
    imports.wbg.__wbg_globalThis_1d39714405582d3c = function() {
        return handleError(function() {
            const ret = globalThis.globalThis;
            return addHeapObject(ret);
        }, arguments);
    };
    imports.wbg.__wbg_global_651f05c6a0944d1c = function() {
        return handleError(function() {
            const ret = global.global;
            return addHeapObject(ret);
        }, arguments);
    };
    imports.wbg.__wbg_set_502d29070ea18557 = function(arg0, arg1, arg2) {
        getObject(arg0)[arg1 >>> 0] = takeObject(arg2);
    };
    imports.wbg.__wbg_isArray_4c24b343cb13cfb1 = function(arg0) {
        const ret = Array.isArray(getObject(arg0));
        return ret;
    };
    imports.wbg.__wbg_instanceof_ArrayBuffer_39ac22089b74fddb = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof ArrayBuffer;
        } catch  {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_call_01734de55d61e11d = function() {
        return handleError(function(arg0, arg1, arg2) {
            const ret = getObject(arg0).call(getObject(arg1), getObject(arg2));
            return addHeapObject(ret);
        }, arguments);
    };
    imports.wbg.__wbg_isSafeInteger_bb8e18dd21c97288 = function(arg0) {
        const ret = Number.isSafeInteger(getObject(arg0));
        return ret;
    };
    imports.wbg.__wbg_getTime_5e2054f832d82ec9 = function(arg0) {
        const ret = getObject(arg0).getTime();
        return ret;
    };
    imports.wbg.__wbg_new0_c0be7df4b6bd481f = function() {
        const ret = new Date();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_43f1b47c28813cbd = function(arg0, arg1) {
        try {
            var state0 = {
                a: arg0,
                b: arg1
            };
            var cb0 = (arg0, arg1)=>{
                const a = state0.a;
                state0.a = 0;
                try {
                    return __wbg_adapter_152(a, state0.b, arg0, arg1);
                } finally{
                    state0.a = a;
                }
            };
            const ret = new Promise(cb0);
            return addHeapObject(ret);
        } finally{
            state0.a = state0.b = 0;
        }
    };
    imports.wbg.__wbg_resolve_53698b95aaf7fcf8 = function(arg0) {
        const ret = Promise.resolve(getObject(arg0));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_then_f7e06ee3c11698eb = function(arg0, arg1) {
        const ret = getObject(arg0).then(getObject(arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_buffer_085ec1f694018c4f = function(arg0) {
        const ret = getObject(arg0).buffer;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_newwithbyteoffsetandlength_6da8e527659b86aa = function(arg0, arg1, arg2) {
        const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_8125e318e6245eed = function(arg0) {
        const ret = new Uint8Array(getObject(arg0));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_set_5cf90238115182c3 = function(arg0, arg1, arg2) {
        getObject(arg0).set(getObject(arg1), arg2 >>> 0);
    };
    imports.wbg.__wbg_length_72e2208bbc0efc61 = function(arg0) {
        const ret = getObject(arg0).length;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Uint8Array_d8d9cb2b8e8ac1d4 = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof Uint8Array;
        } catch  {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_newwithlength_e5d69174d6984cd7 = function(arg0) {
        const ret = new Uint8Array(arg0 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_subarray_13db269f57aa838d = function(arg0, arg1, arg2) {
        const ret = getObject(arg0).subarray(arg1 >>> 0, arg2 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
        const ret = debugString(getObject(arg1));
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getInt32Memory0()[arg0 / 4 + 1] = len1;
        getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_closure_wrapper279 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 89, __wbg_adapter_36);
        return addHeapObject(ret);
    };
    return imports;
}
function __wbg_init_memory(imports, maybe_memory) {}
function __wbg_finalize_init(instance, module1) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module1;
    cachedFloat64Memory0 = null;
    cachedInt32Memory0 = null;
    cachedUint8Memory0 = null;
    return wasm;
}
function initSync(module1) {
    if (wasm !== undefined) return wasm;
    const imports = __wbg_get_imports();
    __wbg_init_memory(imports);
    if (!(module1 instanceof WebAssembly.Module)) module1 = new WebAssembly.Module(module1);
    const instance = new WebAssembly.Instance(module1, imports);
    return __wbg_finalize_init(instance, module1);
}
async function __wbg_init(input) {
    if (wasm !== undefined) return wasm;
    if (typeof input === "undefined") input = new URL(require("5e51b4b3664b06d7"));
    const imports = __wbg_get_imports();
    if (typeof input === "string" || typeof Request === "function" && input instanceof Request || typeof URL === "function" && input instanceof URL) input = fetch(input);
    __wbg_init_memory(imports);
    const { instance, module: module1 } = await __wbg_load(await input, imports);
    return __wbg_finalize_init(instance, module1);
}
exports.default = __wbg_init;

},{"5e51b4b3664b06d7":"kgYiQ","@parcel/transformer-js/src/esmodule-helpers.js":"dJv3G"}],"kgYiQ":[function(require,module,exports) {
module.exports = require("a9851df0e2e05cb0").getBundleURL("ao0Rz") + "pachadb_core_wasm_bg.2cbb4ccd.wasm" + "?" + Date.now();

},{"a9851df0e2e05cb0":"5iafi"}],"5iafi":[function(require,module,exports) {
"use strict";
var bundleURL = {};
function getBundleURLCached(id) {
    var value = bundleURL[id];
    if (!value) {
        value = getBundleURL();
        bundleURL[id] = value;
    }
    return value;
}
function getBundleURL() {
    try {
        throw new Error();
    } catch (err) {
        var matches = ("" + err.stack).match(/(https?|file|ftp|(chrome|moz|safari-web)-extension):\/\/[^)\n]+/g);
        if (matches) // The first two stack frames will be this function and getBundleURLCached.
        // Use the 3rd one, which will be a runtime in the original bundle.
        return getBaseURL(matches[2]);
    }
    return "/";
}
function getBaseURL(url) {
    return ("" + url).replace(/^((?:https?|file|ftp|(chrome|moz|safari-web)-extension):\/\/.+)\/[^/]+$/, "$1") + "/";
}
// TODO: Replace uses with `new URL(url).origin` when ie11 is no longer supported.
function getOrigin(url) {
    var matches = ("" + url).match(/(https?|file|ftp|(chrome|moz|safari-web)-extension):\/\/[^/]+/);
    if (!matches) throw new Error("Origin not found");
    return matches[0];
}
exports.getBundleURL = getBundleURLCached;
exports.getBaseURL = getBaseURL;
exports.getOrigin = getOrigin;

},{}],"dJv3G":[function(require,module,exports) {
exports.interopDefault = function(a) {
    return a && a.__esModule ? a : {
        default: a
    };
};
exports.defineInteropFlag = function(a) {
    Object.defineProperty(a, "__esModule", {
        value: true
    });
};
exports.exportAll = function(source, dest) {
    Object.keys(source).forEach(function(key) {
        if (key === "default" || key === "__esModule" || dest.hasOwnProperty(key)) return;
        Object.defineProperty(dest, key, {
            enumerable: true,
            get: function() {
                return source[key];
            }
        });
    });
    return dest;
};
exports.export = function(dest, destName, get) {
    Object.defineProperty(dest, destName, {
        enumerable: true,
        get: get
    });
};

},{}]},["2z5ev","1jwFz"], "1jwFz", "parcelRequire2276")

//# sourceMappingURL=index.8e9bd240.js.map
