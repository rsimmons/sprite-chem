export interface Creator<T, P> {
  readonly create: (params?: P) => T;
}
