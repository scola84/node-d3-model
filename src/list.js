import Model from './model';

export default class ListModel extends Model {
  data(data) {
    return this.remote(data);
  }

  id() {
    const [path, local] = this._id(...this._parse());
    return { path, local };
  }
}
