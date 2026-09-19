export type Either<L, R> = Failure<L> | Success<R>

export class Failure<L> {
  readonly value: L

  constructor(value: L) {
    this.value = value
  }

  isFailure(): this is Failure<L> {
    return true
  }

  isSuccess(): this is Success<never> {
    return false
  }
}

export class Success<R> {
  readonly value: R

  constructor(value: R) {
    this.value = value
  }

  isFailure(): this is Failure<never> {
    return false
  }

  isSuccess(): this is Success<R> {
    return true
  }
}

export const left = <L>(value: L): Either<L, never> => new Failure(value)
export const right = <R>(value: R): Either<never, R> => new Success(value)
