import Model from './model';

export default class ListModel extends Model {
  data(data) {
    return this.remote(data);
  }

  id() {
    return {
      path: this._path,
      query: this._local
    };
  }

  parse() {
    return [this._parse(this._local)];
  }
}
