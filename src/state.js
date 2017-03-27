export default class State {
  constructor() {
    this._conditions = new Map();
    this._values = {};
    this._then = null;
    this._else = null;
  }

  if (name, check) {
    this._conditions.set(name, check);
    return this;
  }

  then(value) {
    this._then = value;
    return this;
  }

  else(value) {
    this._else = value;
    return this;
  }

  set(name, value) {
    this._values[name] = value;
    this._check();

    return this;
  }

  _check() {
    let passed = 0;

    this._conditions.forEach((check, name) => {
      passed += Number(check(this._values[name]));
    });

    if (passed === this._conditions.size) {
      if (this._then) {
        this._then(this._values);
      }
    } else if (this._else) {
      this._else(this._values);
    }
  }
}
