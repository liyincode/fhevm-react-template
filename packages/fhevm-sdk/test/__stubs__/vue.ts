// Minimal Vue 3 runtime stub for unit testing composables without bundling the real framework.
type RefLike<T = any> = { value: T };

export const ref = <T>(value: T): RefLike<T> => ({ value });
export const shallowRef = ref;

export const computed = <T>(getter: () => T): RefLike<T> =>
  ({
    get value() {
      return getter();
    },
  } as RefLike<T>);

export const readonly = <T>(value: T): T => value;

export const isRef = (value: unknown): value is RefLike =>
  typeof value === "object" && value !== null && "value" in (value as any);

let currentProvides: Map<unknown, unknown> | null = null;
let currentComponent: { unmounts: Array<() => void> } | null = null;

export const inject = <T>(key: unknown, fallback: T | null = null): T | null => {
  if (currentProvides && currentProvides.has(key)) {
    return currentProvides.get(key) as T;
  }
  return fallback;
};

export const nextTick = () => Promise.resolve();

type Cleanup = () => void;

export const watch = (
  source: unknown,
  callback: (value: any, oldValue: any, onCleanup: (fn: Cleanup) => void) => void,
) => {
  const resolve = () => {
    if (Array.isArray(source)) {
      return source.map(item => {
        if (typeof item === "function") return (item as () => unknown)();
        if (isRef(item)) return item.value;
        return item;
      });
    }
    if (typeof source === "function") {
      return (source as () => unknown)();
    }
    if (isRef(source)) {
      return source.value;
    }
    return source;
  };

  const cleanups: Cleanup[] = [];
  const onCleanup = (fn: Cleanup) => {
    cleanups.push(fn);
  };

  callback(resolve(), undefined, onCleanup);

  return () => {
    cleanups.forEach(fn => fn());
  };
};

export const defineComponent = <T>(component: T): T => component;

export const onBeforeUnmount = (fn: () => void) => {
  if (currentComponent) {
    currentComponent.unmounts.push(fn);
  }
};

export const createApp = (rootComponent: any) => {
  const provides = new Map<unknown, unknown>();
  let mounted = false;

  return {
    provide(key: unknown, value: unknown) {
      provides.set(key, value);
      return this;
    },
    use(plugin: { install?: (app: any) => void }) {
      plugin?.install?.(this);
      return this;
    },
    mount(_container: unknown) {
      if (mounted) return {};
      mounted = true;
      currentProvides = provides;
      currentComponent = { unmounts: [] };
      rootComponent.setup?.();
      currentComponent = null;
      currentProvides = null;
      return {};
    },
    unmount() {
      if (!mounted) return;
      mounted = false;
      currentComponent?.unmounts.forEach(fn => fn());
      currentComponent = null;
    },
  };
};
