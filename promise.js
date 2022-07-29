const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

const createMicrotask = (task, defer) => args =>
  queueMicrotask(() => {
    try {
      const results = task(args)
      resolvePromise(results, defer.promise, defer.resolve, defer.reject)
    } catch (error) {
      defer.reject(error)
    }
  })

class Promise {
  constructor(executor) {
    if (typeof executor !== 'function') {
      throw new TypeError(`Promise resolver ${executor} is not a function`)
    }
    this.PromiseState = PENDING
    this.PromiseResult = void 0
    this.chainIsEnd = true
    this.onFulfilledCallbacks = []
    this.onRejectedCallbacks = []

    const changeState = (state, value, queue) => {
      if (this.PromiseState == PENDING) {
        this.PromiseState = state
        this.PromiseResult = value
        queue.forEach(cb => cb(this.PromiseResult))
      }
    }
    const resolve = value => {
      changeState(FULFILLED, value, this.onFulfilledCallbacks)
    }
    const reject = value => {
      changeState(REJECTED, value, this.onRejectedCallbacks)
      queueMicrotask(() => {
        if (!this.onRejectedCallbacks.length && this.chainIsEnd) {
          throw `in Promise ${value}`
        }
      })
    }

    try {
      executor(resolve, reject)
    } catch (e) {
      reject(e)
    }
  }
  then(onFulfilled, onRejected) {
    this.chainIsEnd = false

    if (typeof onFulfilled !== 'function') {
      onFulfilled = v => v
    }

    if (typeof onRejected !== 'function') {
      onRejected = r => {
        throw r
      }
    }
    const defer = Promise.defer()

    if (this.PromiseState === PENDING) {
      this.onFulfilledCallbacks.push(createMicrotask(onFulfilled, defer))
      this.onRejectedCallbacks.push(createMicrotask(onRejected, defer))
    } else if (this.PromiseState === FULFILLED) {
      createMicrotask(onFulfilled, defer)(this.PromiseResult)
    } else if (this.PromiseState === REJECTED) {
      createMicrotask(onRejected, defer)(this.PromiseResult)
    }

    return defer.promise
  }
  catch(onRejected) {
    return this.then(undefined, onRejected)
  }
  finally(callback) {
    return this.then(
      value => Promise.resolve(callback()).then(() => value),
      reason =>
        Promise.resolve(callback()).then(() => {
          throw reason
        })
    )
  }
}

const resolvePromise = (x, promise, resolve, reject) => {
  const isPromise = x instanceof Promise
  const isSamePromise = promise === x
  const isObject = !!x && typeof x === 'object'
  const isFunction = typeof x === 'function'

  if (isSamePromise) {
    reject(new TypeError('Chaining cycle detected for promise'))
  }

  if (isPromise) {
    x.then(
      value => resolvePromise(value, promise, resolve, reject),
      reason => reject(reason)
    )
  } else if (isObject || isFunction) {
    let called = false
    const checkIsCalled = () => {
      if (!called) {
        return (called = !called), !called
      }
      return called
    }
    try {
      const then = x.then
      const isThenable = typeof then === 'function'
      const onFulfilled = value => {
        if (checkIsCalled()) return
        resolvePromise(value, promise, resolve, reject)
      }
      const onRejected = reason => {
        if (checkIsCalled()) return
        reject(reason)
      }
      if (isThenable) {
        then.call(x, onFulfilled, onRejected)
      } else {
        resolve(x)
      }
    } catch (e) {
      if (checkIsCalled()) return
      reject(e)
    }
  } else {
    resolve(x)
  }
}
Promise.defer = () => {
  const defer = {}
  defer.promise = new Promise((resolve, reject) => {
    defer.resolve = resolve
    defer.reject = reject
  })
  return defer
}

Promise.resolve = value => {
  if (value instanceof Promise) {
    return value
  }

  if (typeof value === 'object' || typeof value === 'function') {
    try {
      const then = value.then
      if (typeof then === 'function') {
        return new Promise(then.bind(value))
      }
    } catch (e) {
      return new Promise((resolve, reject) => {
        reject(e)
      })
    }
  }

  return new Promise(resolve => resolve(value))
}

Promise.reject = value => {
  return new Promise((resolve, reject) => reject(value))
}

Promise.all = promises => {
  const results = []
  const n = promises.length
  let resolveCount = 0
  return new Promise((resolve, reject) => {
    promises.forEach((p, i) => {
      Promise.resolve(p).then(
        val => {
          results[i] = val
          resolveCount++
          if (resolveCount === n) {
            resolve(results)
          }
        },
        reason => reject(reason)
      )
    })
  })
}

Promise.race = promises => {
  return new Promise((resolve, reject) => {
    promises.forEach((p, i) => {
      Promise.resolve(p).then(
        val => resolve(val),
        reason => reject(reason)
      )
    })
  })
}
