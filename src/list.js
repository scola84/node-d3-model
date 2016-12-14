import Model from './model';

export default class ListModel extends Model {
  data(value) {
    return this.remote(value);
  }

  id() {
    const [path, local] = this._id(...this._parse());
    return { path, local };
  }
}
