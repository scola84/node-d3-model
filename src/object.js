import { ScolaError } from '@scola/error';
import Model from './model';

export default class ObjectModel extends Model {
  data(value) {
    if (value === null) {
      return this.local();
    }

    return this
      .local(value)
      .remote(value);
  }

  id() {
    const [path] = this._id(...this._parse());
    return { path };
  }

  insert(callback = () => {}) {
    if (this._state === 'busy') {
      callback(new ScolaError('500 model_state busy'));
      return;
    }

    this._state = 'busy';
    const [path, local] = this._parse();

    const request = this._connection
      .request()
      .method('POST')
      .path(path);

    request.once('error', (error) => {
      this._state = 'idle';
      callback(error);
    });

    request.end(local, (response) => {
      this._handleInsert(response, (error, data) => {
        this._state = 'idle';
        callback(error, data);
      });
    });
  }

  update(callback = () => {}) {
    if (this._state === 'busy') {
      callback(new ScolaError('500 model_state busy'));
      return;
    }

    this._state = 'busy';
    const [path, local] = this._parse();

    const request = this._connection
      .request()
      .method('PUT')
      .path(path);

    request.once('error', (error) => {
      this._state = 'idle';
      callback(error);
    });

    request.end(local, (response) => {
      this._handleUpdate(response, (error, data) => {
        this._state = 'idle';
        callback(error, data);
      });
    });
  }

  delete(callback = () => {}) {
    if (this._state === 'busy') {
      callback(new ScolaError('500 model_state busy'));
      return;
    }

    this._state = 'busy';
    const [path] = this._parse();

    const request = this._connection
      .request()
      .method('DELETE')
      .path(path);

    request.once('error', (error) => {
      this._state = 'idle';
      callback(error);
    });

    request.end(null, (response) => {
      this._handleDelete(response, (error, data) => {
        this._state = 'idle';
        callback(error, data);
      });
    });
  }

  _handleInsert(response, callback) {
    this._extract(response, (extractError) => {
      if (extractError) {
        callback(extractError);
        return;
      }

      if (response.status() !== 201) {
        callback(new ScolaError(response.data()));
        return;
      }

      this._handleResponse(response, (error, data) => {
        this.emit('insert');
        callback(error, data);
      });
    });
  }

  _handleUpdate(response, callback) {
    this._extract(response, (extractError) => {
      if (extractError) {
        callback(extractError);
        return;
      }

      if (response.status() !== 200) {
        callback(new ScolaError(response.data()));
        return;
      }

      this._handleResponse(response, (error, data) => {
        this.emit('update');
        callback(error, data);
      });
    });
  }

  _handleDelete(response, callback) {
    this._extract(response, (extractError) => {
      if (extractError) {
        callback(extractError);
        return;
      }

      if (response.status() !== 200) {
        callback(new ScolaError(response.data()));
        return;
      }

      this.remove((error) => {
        this.emit('delete');
        callback(error);
      });
    });
  }
}
