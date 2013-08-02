#!/bin/sh
fval1=`cat $1 | grep "filter1"| cut -d"=" -f2 | tr -d ' '`
fval2=`cat $1 | grep "filter2"| cut -d"=" -f2 | tr -d ' '`
sed -e 's/filter1/'$fval1'/g' index.html  >  temp.html
sed -e 's/filter2/'$fval2'/g' temp.html  >  temp1.html
mv temp1.html index.html
sed -e 's/filter1/'$fval1'/g' tsdb.js  >  temp.js
sed -e 's/filter2/'$fval2'/g' temp.js  >  temp1.js
mv temp1.js tsdb.js

