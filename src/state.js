export default class State {
  constructor() {
    this._conditions = new Map();
    this._values = {};
    this._last = null;
    this._then = null;
    this._else = null;
  }

  if (name) {
    this._last = name;
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

  custom(value) {
    this._conditions.set(this._last, value);
    return this;
  }

  defined() {
    this._conditions.set(this._last, (value) => {
      return typeof value !== 'undefined';
    });

    return this;
  }

  undefined() {
    this._conditions.set(this._last, (value, set) => {
      return typeof value === 'undefined' && set === true;
    });

    return this;
  }

  false() {
    this._conditions.set(this._last, (value) => {
      return value === false;
    });

    return this;
  }

  falsy() {
    this._conditions.set(this._last, (value) => {
      return Boolean(value) === false;
    });

    return this;
  }

  number() {
    this._conditions.set(this._last, (value) => {
      return typeof value === 'number';
    });

    return this;
  }

  true() {
    this._conditions.set(this._last, (value) => {
      return value === true;
    });

    return this;
  }

  truthy() {
    this._conditions.set(this._last, (value) => {
      return Boolean(value) === true;
    });

    return this;
  }

  _check() {
    let checked = null;
    let passed = 0;

    this._conditions.forEach((check, name) => {
      checked = check(this._values[name], name in this._values);
      passed += Number(checked);
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
