(() => {
  "use strict";

  if (window.__NEARER_HD_CANVAS_PREFLIGHT) return;
  window.__NEARER_HD_CANVAS_PREFLIGHT = true;

  const prototype = HTMLCanvasElement.prototype;
  const nativeGetContext = prototype.getContext;
  const widthDescriptor = Object.getOwnPropertyDescriptor(prototype, "width");
  const heightDescriptor = Object.getOwnPropertyDescriptor(prototype, "height");

  const isGlobeCanvas = canvas => {
    const id = canvas.id || "";
    return id === "globeCanvas" || id === "raceGlobeCanvas" || /globe/i.test(id) || canvas.classList.contains("globe-canvas");
  };

  const qualityFactor = () => matchMedia("(max-width: 820px)").matches ? 1.75 : 1.35;

  prototype.getContext = function patchedGetContext(type, options) {
    if (type !== "2d" || !isGlobeCanvas(this)) {
      return nativeGetContext.call(this, type, options);
    }

    if (this.__nearerHdContext) return this.__nearerHdContext;

    const canvas = this;
    const factor = qualityFactor();

    if (!canvas.__nearerHdDimensions && widthDescriptor && heightDescriptor) {
      Object.defineProperty(canvas, "width", {
        configurable: true,
        enumerable: widthDescriptor.enumerable,
        get() { return widthDescriptor.get.call(canvas); },
        set(value) { widthDescriptor.set.call(canvas, Math.max(1, Math.round(Number(value || 1) * factor))); }
      });
      Object.defineProperty(canvas, "height", {
        configurable: true,
        enumerable: heightDescriptor.enumerable,
        get() { return heightDescriptor.get.call(canvas); },
        set(value) { heightDescriptor.set.call(canvas, Math.max(1, Math.round(Number(value || 1) * factor))); }
      });
      canvas.__nearerHdDimensions = true;
    }

    const context = nativeGetContext.call(canvas, type, options);
    if (!context) return context;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const proxy = new Proxy(context, {
      get(target, property) {
        if (property === "setTransform") {
          return (a, b, c, d, e, f) => target.setTransform(
            Number(a) * factor,
            Number(b) * factor,
            Number(c) * factor,
            Number(d) * factor,
            Number(e) * factor,
            Number(f) * factor
          );
        }
        if (property === "resetTransform") {
          return () => target.setTransform(factor, 0, 0, factor, 0, 0);
        }
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
      set(target, property, value) {
        return Reflect.set(target, property, value, target);
      }
    });

    canvas.__nearerHdContext = proxy;
    canvas.dataset.renderQuality = "hd";
    return proxy;
  };
})();
