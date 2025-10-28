declare module "vue" {
  export type Ref<T = any> = { value: T };
  export type ComputedRef<T = any> = Readonly<Ref<T>>;
  export type MaybeRef<T> = T | Ref<T>;

  export function ref<T>(value: T): Ref<T>;
  export function shallowRef<T>(value: T): Ref<T>;
  export function computed<T>(getter: () => T): ComputedRef<T>;
  export function readonly<T>(value: T): T;
  export function isRef(value: unknown): value is Ref<any>;

  export function watch<T>(
    source: any,
    cb: (value: T, oldValue: T | undefined, onCleanup: (fn: () => void) => void) => void,
    options?: { immediate?: boolean }
  ): () => void;

  export type InjectionKey<T> = symbol | string;
  export function inject<T>(key: InjectionKey<T>, defaultValue?: T | null): T | null;

  export interface Plugin {
    install(app: App): void;
  }

  export interface App {
    provide(key: unknown, value: unknown): this;
    use(plugin: Plugin): this;
    mount(container: unknown): unknown;
    unmount(): void;
  }

  export function createApp(rootComponent: any): App;
  export function defineComponent<T>(options: T): T;
  export function onBeforeUnmount(fn: () => void): void;
  export function nextTick(): Promise<void>;
}
