(function(b,d){var c=b.parse,a=[1,4,5,6,7,10,11];b.parse=function(f){var j,l,h=0;if((l=/^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(f))){for(var g=0,e;(e=a[g]);++g){l[e]=+l[e]||0}l[2]=(+l[2]||1)-1;l[3]=+l[3]||1;if(l[8]!=="Z"&&l[9]!==d){h=l[10]*60+l[11];if(l[9]==="+"){h=0-h}}j=b.UTC(l[1],l[2],l[3],l[4],l[5]+h,l[6],l[7])}else{j=c?c(f):NaN}return j}}(Date));