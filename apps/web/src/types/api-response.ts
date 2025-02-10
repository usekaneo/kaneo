type ApiResponse<T extends (...args: never[]) => Promise<unknown>> = Awaited<
  ReturnType<T>
>['data'];

export default ApiResponse;
