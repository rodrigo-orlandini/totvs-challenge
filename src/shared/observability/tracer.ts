interface Span {
  end(): void
  setAttribute(key: string, value: string | number | boolean): void
}

export const tracer = {
  startSpan(_name: string): Span {
    return {
      end() {},
      setAttribute() {},
    }
  },
}
