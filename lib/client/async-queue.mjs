class AsyncQueue {
  constructor() {
    this.queue = [];
    this.resolvers = [];
    this.ended = false;
  }
  // Method to enqueue data into the queue
  enqueue(item, callback) {
    if (this.ended) {
      throw new Error("Cannot enqueue on a closed queue.");
    }
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift();
      resolve({ value: item, done: false });
    } else {
      this.queue.push(item);
    }
    if (callback) {
      callback.call(this);
    }
  }
  // Method to end the queue
  end(callback) {
    if (this.ended) {
      throw new Error("Queue already ended.");
    }
    this.ended = true;
    // Resolve all pending promises with done: true
    while (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift();
      resolve({ value: undefined, done: true });
    }
    if (callback) {
      callback.call(this);
    }
  }
  // Method to create an asynchronous iterator
  [Symbol.asyncIterator]() {
    return {
      next: () => {
        if (this.queue.length > 0) {
          const value = this.queue.shift();
          return Promise.resolve({ value, done: false });
        }
        if (this.ended) {
          return Promise.resolve({ value: undefined, done: true });
        }
        const { promise, resolve, reject } = Promise.withResolvers();
        this.resolvers.push(resolve);
        return promise;
      },
    };
  }
}
export default AsyncQueue;
export { AsyncQueue };

// // Usage Example
// async function exampleUsage() {
//   const asyncQueue = new AsyncQueue();

//   // Enqueue items
//   setTimeout(() => asyncQueue.enqueue(1), 1000);
//   setTimeout(() => asyncQueue.enqueue(2), 2000);
//   setTimeout(() => asyncQueue.enqueue(3), 3000);
//   setTimeout(() => asyncQueue.end(), 4000);

//   // Consume items
//   for await (const item of asyncQueue) {
//     console.log(item);
//   }

//   console.log("Queue has ended.");
// }

// exampleUsage();
