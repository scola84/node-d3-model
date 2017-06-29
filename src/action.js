export default class Action {
  constructor() {
    this._actions = {};
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
}
