# couch-restore

A simple utility for restoring couchdb databases

#### Installation
```
$ npm install -g couch-restore
```

#### Usage

Optionally add a `.couch` file to your backup directory containing the url for your instance of couchdb
```
{
	"url": "http://username:password@localhost:5984"
}
```
Restore the database from backup file (optionally specify couchdb url with `--url`)
```
$ couch-restore backup.json newdatabasename
```
