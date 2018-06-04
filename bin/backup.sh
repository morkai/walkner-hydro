#!/bin/bash

BACKUP_FILE=`date +"%y%m%d"`__hydro.7z

rm -rf /root/dump
cd /root

mongodump --numParallelCollections 1 \
 --db walkner-hydro \
 --excludeCollection sessions \
 --excludeCollection events \
 --excludeCollectionsWithPrefix "tags.health"

7zr a -t7z -m0=lzma -mx=5 -r $BACKUP_FILE /root/dump
rm -rf /root/dump
/root/drive upload -f /root/$BACKUP_FILE -p 0B0WngVQEFzUVd1pQdHduR09xN28
rm $BACKUP_FILE
