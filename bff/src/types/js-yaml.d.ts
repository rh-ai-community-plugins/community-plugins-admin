declare module 'js-yaml' {
  function load(input: string, options?: object): unknown;
  function dump(obj: unknown, options?: object): string;
  export { load, dump };
  export default { load, dump };
}
