import { DisposableLike, SchedulerPort } from '../../../foundation/ports/scheduler-port';

export class NodeSchedulerPort implements SchedulerPort {
  setInterval(handler: () => void, ms: number): DisposableLike {
    const id = setInterval(handler, ms);
    return { dispose: () => clearInterval(id) };
  }

  setTimeout(handler: () => void, ms: number): DisposableLike {
    const id = setTimeout(handler, ms);
    return { dispose: () => clearTimeout(id) };
  }
}
