import Observable from './observable';
import Observer from './observer';

export default class Action extends Observer {
  constructor() {
    super();

    this._actions = {};
    this.model(new Observable());
  }

  register(name, value = null) {
    if (value === null) {
      return this._actions[name];
    }

    this._actions[name] = value;
    return this;
  }

  handle(name, value) {
    if (typeof this._actions[name] === 'function') {
      this._actions[name](value);
    }

    return this;
  }

  _set(setEvent) {
    this.handle(setEvent.name, setEvent.value);
  }
}
