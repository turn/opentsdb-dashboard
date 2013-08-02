// This file is part of OpenTSDB Dashboard.
// // Copyright (C) 2013  Turn Inc.
// //
// // This program is free software: you can redistribute it and/or modify it
// // under the terms of the GNU Lesser General Public License as published by
// // the Free Software Foundation, either version 2.1 of the License, or (at your
// // option) any later version.  This program is distributed in the hope that it
// // will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
// // of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
// // General Public License for more details.  You should have received a copy
// // of the GNU Lesser General Public License along with this program.  If not,
// // see <http://www.gnu.org/licenses/>.

/*
 * Declaring and Initializing globals
*/
var OPENTSDB_URL = '<OpenTSDB URL>:<PORT>/q?start=';  //eg: 'http://tsdb.com:4242/q?start=' 
var DASHBOARDS_DIR = '<JSON_FILE_PATH>';  // path of json files
var DEFAULT_FILTER1 = '';
var DEFAULT_FILTER2 = '';
var DEFAULT_FROM = '24h-ago';
var DEFAULT_GRAPH_HEIGHT = 300;
var DEFAULT_GRAPH_WIDTH = 600;
var DEFAULT_TOOLTIP = 'View full screen';
var DEFAULT_AGGREGATION = 'sum';
var DEFAULT_NODISPLAY = 'false';
var DEFAULT_KEY = 'top right box';
var DEFAULT_BOX = 'box';
var DEFAULT_Y_FORMAT = "%1.1s %c";
var DEFAULT_COL=2;
var DEFAULT_HEIGHT=200;
var DEFAULT_WIDTH=750;
var DS_FACTOR = 6;
var UNIT = 'avg';

var axes_params='';
var graphWidth=DEFAULT_WIDTH;
var graphHeight=DEFAULT_HEIGHT;
var key_params='';
var style_params='';
var o='';
var duration = 0;
var start_ds = 0;
var end_ds = 0;
var ds_duration = 0;
var url = '';
var k = 0;

var tsdb_filter = {
  FILTER1: "filter1",
  FILTER2: "filter2",
};

String.prototype.startsWith = function(s) { 
return (this.indexOf(s) === 0); };
String.prototype.endsWith = function(s) { 
return (this.indexOf(s) === (this.length-s.length) && s.length <= this.length); };
jQuery.support.cors = true;

var dashboard = (function($) {

function buildGraphs(fval1, from, data,fval2,smooth,flip) {
  if (!data) {
    return;
  }

var now = new Date();
var dashboard_properties = data['dashboard_properties'];
var panel_objects;
var graph_objects;
var datastream_objects;
var tag_objects ;
var start = '';
var end = '';
var columns = 0;
var html = '';
var extras = '';
var sum =0;
var graph_object_count = 0; 
var i=0;
var counter=0;
var col_separator=0;

if (dashboard_properties['title']) {
  document.title = dashboard_properties['title'] + ' ' + document.title;
} 
if (dashboard_properties['dc']) {
  document.title = '[' + dashboard_properties['dc'] + '] ' + document.title; 
}

if (data['panel_objects']) {
  /*
    * Calculating the total graph objects.
  */
  for (i=0; i < data['panel_objects'].length; i++) {
    panel_objects = data['panel_objects'][i];
    graph_object_count += panel_objects['graph_objects'].length;
  }
  col_separator = parseInt((graph_object_count)/(dashboard_properties['column']|| DEFAULT_COL));  //Used to split the dashboard into columns
  for (i=0; i < data['panel_objects'].length; i++) {
    panel_objects = data['panel_objects'][i];

    for (var j=0; j < panel_objects['graph_objects'].length; j++) {
        graph_objects = panel_objects['graph_objects'][j];
        if ( (counter==0 && i==0) || (counter%col_separator==0) && 
             ((dashboard_properties['column']&&(columns < dashboard_properties['column'])) ||
             (!dashboard_properties['column'] && columns < DEFAULT_COL))) {
          columns++;
          html += '<td width="' + Math.round(100/data['panel_objects'].length) + '%">\n';  
          //If there is column change then print the panel object title.
          if (panel_objects['title']) {
            html += '<h2>' + panel_objects['title'] + '</h2>\n\n';
          }
        }
        else if (j==0) {
         if (panel_objects['title']) {
          html += '<h2>' + panel_objects['title'] + '</h2>\n\n';
         }
        }
        if (graph_objects['title']) {
         html += '<h3>' + graph_objects['title'] + '</h2>\n\n';
        }
        k=0;
        url=''
        
        /*
           Setting start and end time. If it is passed from dashboard then the value will override all other value.
           Time specified in the dashboard overrides the one specified in graph_objects.
           Precedence Order: 
	   1) Passed from Url
           2) Value Present in Dashboard Object
           3) Value Present in Graph Properties
        */
        if (from.indexOf("-")!=-1) {
          if (from.substring(from.indexOf("-")+1)=="ago" || from.substring(from.indexOf("-")+1)=="win") {
            start = from;
            start_ds = getFormattedDate(from);
          }
        } else {
           start =  dashboard_properties['start_time'] || graph_objects['start_time'] || from ;
           start_ds =  getFormattedDate(dashboard_properties['start_time'] || graph_objects['start_time'] || from) ;
           if ((dashboard_properties['end_time']!='') || (graph_objects['end_time'])) { 
            end = dashboard_properties['end_time'] || graph_objects['end_time'] ;
            end_ds = getFormattedDate(dashboard_properties['end_time'] || graph_objects['end_time']) ;
           }
        }
        /*
           Calculating the difference between start and endtime. Downsmapling will be decided on the 
           length of this interval. We divide the interval with the graphWidth and then multiply the
           ratio with a constant factor. Format is yyyy/mm/dd-HH:MM:SS
        */
        if(start_ds.indexOf("/")!=-1) {
          start_ds = start_ds.replace(/:|-/g,'/');
          start_ds = new Date(start_ds.split("/")[0],start_ds.split("/")[1]-1,start_ds.split("/")[2],start_ds.split("/")[3],start_ds.split("/")[4],start_ds.split("/")[5]).getTime();
        } 
        if(end_ds && end_ds.indexOf("/")!=-1) {
          end_ds = end_ds.replace(/:|-/g,'/');
          end_ds = (new Date(end_ds.split("/")[0],end_ds.split("/")[1]-1,end_ds.split("/")[2],end_ds.split("/")[3],end_ds.split("/")[4],end_ds.split("/")[5])).getTime();
        }
        duration = (end_ds > start_ds)?(end_ds-start_ds):((new Date()).getTime()-start_ds);
        /*
	  Looping over datastream objects and building the m-parameter of url
        */           
        for (k=0; k < graph_objects['datastream_objects'].length; k++) {
          datastream_objects = graph_objects['datastream_objects'][k];
          if (!datastream_objects['metric_name']) {
            continue;
          }
          
          /*
           Building the Axes, Key and Style params of url 
          */
          if (graph_objects['axes']) {
            if (datastream_objects['right_axes']) {
              axes_params = getAxesParams(graph_objects['axes'],true);
            } else {
              axes_params = getAxesParams(graph_objects['axes'],false);
            }
          }

          if (graph_objects['key']) {
            key_params = getKeyParams(graph_objects['key']);
          }

          if (graph_objects['style']) {
	    style_params = getStyleParams(graph_objects['style'],smooth);
          }
          /*
           * Setting up the optional parameter per datastream object             
          */
          o = axes_params + key_params + style_params;
          /*
          Setting graph width in the following precedence
          1) Value set in Graph Object width
          2) Value set in dashboard properties OR panel_objects OR 95% of windowWidth divided by min(2, panel_objects count)
          3) Default value       
          */
          graphWidth = graph_objects['width'] || ( (dashboard_properties['width']|| panel_objects['width'] || 
                       0.95 * window.innerWidth) / (Math.min(2,data['panel_objects'].length) ) ) || DEFAULT_GRAPH_WIDTH;
          graphWidth = parseInt(graphWidth);  
       
          /*
          Setting graph height in the following precedence
          1) Value set in Graph Object height
          2) Value set in 2*(dashboard properties) divided by total graph count OR 
             panel_object height divided by count_of_graph_objects in this panel_object OR 
             95% of windowHeight divided by count_of_datastream_objects length
          3) Default value       
          */
          graphHeight = graph_objects['height'] || (2*dashboard_properties['height']/graph_object_count) || 
                       (panel_objects['height']/panel_objects['graph_objects'].length)  || 
                       (0.95 * window.innerHeight) / graph_objects['datastream_objects'].length || DEFAULT_GRAPH_HEIGHT;
          graphHeight = parseInt(graphHeight);  
          var graphTooltip = graph_objects['tooltip'] || DEFAULT_TOOLTIP;
          var aggregation = datastream_objects['aggregation'] || DEFAULT_AGGREGATION;    
          url = url + '&m='+ aggregation ;          
          ds_duration = ((DS_FACTOR*duration)/(60*graphWidth*1000));
          /*
            Setting up scale
          */
          if (datastream_objects['scale']) {
            url = url + ':' + escape(encodeURIComponent(datastream_objects['scale']));
          } else {
            url = url + ':';
          }
           
          /*
            Setting up gnubox
          */
          if (datastream_objects['gnubox']) {
            url = url + ':' + escape(encodeURIComponent(datastream_objects['gnubox']));
          } else {
            url = url + ':';
          }
          /*
           Setting up alias
          */
          if (datastream_objects['alias']) {
            var alias = escape(encodeURIComponent(datastream_objects['alias'])) ;
            url = url + ':' + alias;
          } else {
            url = url + ':';
          }
 
          /*
           Setting up downsampling
          */
          if (datastream_objects['downsampling']) {
            url = url + ':' + datastream_objects['downsampling'];
          } else {
            var ds = getDownsampleDuration(ds_duration);
	    if (ds > 1) {
              url = url + ':' + getDownsampleDuration(ds_duration);
	    } else {
              url = url + ':' + '';
	    }
          }
       
          /*
           Setting up rate
          */
          if (datastream_objects['rate']) {
            url = url + ':' + datastream_objects['rate'];
          } else {
            url = url + ':';
          }

          /*
           Setting up metric name
          */
          url = url + ':' + datastream_objects['metric_name'];

          /*
           Setting up tags
          */
          if (datastream_objects['tags']) {
            if (datastream_objects['tags'].length > 0) {     /// appending tagvalues in url if present
              url = url + '{' +getTagValue(datastream_objects,fval1,fval2)+ '}';
            }
          } else if(fval1 || fval2) {      /// To handle case where tags is missing but we have the default fval1 or fval2
            url = url + '{';
            if (fval1) {
              url = url + tsdb_filter['FILTER1']+"="+fval1;
            }  
            if (fval2) {
              if (fval1) {
                url = url +",";
              }
            url = url + tsdb_filter['FILTER2']+"="+fval2;
            } 
            url = url + '}';
          } 

	  if (datastream_objects['nodisplay']) {
            url = url + '&nodisplay='+datastream_objects['nodisplay'];
	  } else {
            url = url + '&nodisplay=false';
          } 

	  if (datastream_objects['filter']) {
            url = url + '&filter='+datastream_objects['filter']+o;
	  } else {
            url = url + '&filter=none:1'+o;
          }
          
          /*
           Setting up right axes
          */
          if (datastream_objects['right_axes']) {
            url = url +'&o=axis x1y2'+o;
          } else {
            url = url +'&o='+o;
          }

       } // datastream loop ends here

       /*
        Setting up end time if exists
       */
       if (end!='') {
         url = OPENTSDB_URL + start + '&end=' +end + url;       
       } else {
         url = OPENTSDB_URL + start + url;       
       }
       /*
        Setting up flip to change the foreground and background color
       */
       if (flip!=null) {
         url = url +'&flip=true';
       }

       url = url + '&wxh=' + graphWidth +'x' + graphHeight ; 
       html += '<a href="' + url.replace('q?','#') + '" target="_blank"><img title="' +
             graphTooltip + '" class="loading" src="' + url + '&png'+ '" width="' + graphWidth +
             '" height="' + graphHeight + '" /></a>\n\n';
       counter++;
    }
  }
  html += '</td>\n\n';
  }

  $('#contents tr').html(html);
  $('#contents img[title]').qtip({
    position: {
      my: 'top left',
      target: 'mouse',
      viewport: $(window),
      adjust: { x: 10,  y: 10 },
    },
      hide: { fixed: true },
  });
  $('#contents img').load(function() {
    $(this).removeClass('loading'); });
    $('h1').html(data['dashboard_properties']['title'] + ' ' +
    $('h1').html());
}

function getURLParam(name) {
  var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
  if (!results) { return null; }
  return results[1] || null;
}

function setClock(e) {
  var now = new Date();
  e.text(now.getHours() + ':' +
    (now.getMinutes() < 10 ? '0' : '') + now.getMinutes() + ':' +
    (now.getSeconds() < 10 ? '0' : '') + now.getSeconds());
}

Number.prototype.pad = function (len) {
  return (new Array(len+1).join("0")+this).slice(-len);
}

/* 
  Takes a date and convert it into yyyy/mm/dd-HH:MM:SS format.
*/
function getFormattedDate(time) {
  var input_time  = time;  
  var interval ;
  var metric;
  var date;
  var formatted_date;
  /* 
   input_time is already in yyyy/mm/dd-HH:MM:SS format. Return it.
  */ 
  if (input_time.indexOf("/") != -1) {
    return input_time;
  }
  /* 
   input_time is  like 2h-ago. Convert it in yyyy/mm/dd-HH:MM:SS format
  */ 
  if (input_time.indexOf("-") != -1) {
    interval = input_time.substring(0,input_time.indexOf("-")-1);
    metric = input_time.substring(input_time.indexOf("-")-1,input_time.indexOf("-"));
  } else {
    match = input_time.match(/^(\d+)([a-zA-Z])/);
    interval = match[1]; 
    metric = match[2];
  }
  switch(metric.toLowerCase()) {
    case 's': break;                               // seconds
    case 'm': interval *= 60; break;               // minutes
    case 'h': interval *= 3600; break;             // hours
    case 'd': interval *= 3600 * 24; break;        // days
    case 'w': interval *= 3600 * 24 * 7; break;    // weeks
    case 'M': interval *= 3600 * 24 * 30; break;    // month
    case 'y': interval *= 3600 * 24 * 365; break;   // year
  }
  date = (new Date).getTime();
  date = date -interval*1000;
  var d = new Date(date);
  formatted_date = d.getFullYear()+"/"+(d.getMonth()+1).pad(2)+"/"+d.getDate().pad(2)+"-"+d.getHours().pad(2)+":"+d.getMinutes().pad(2)+":"+d.getSeconds().pad(2);
    
  return formatted_date;
}
/*
  Returns the axes params.
*/ 
function getAxesParams(axes, y2axis_flag) {
    var axes_param='';
    if (axes['ylabel']) {
      axes_param = axes_param + '&ylabel=' + escape(encodeURI(axes['ylabel']));
    } 
    if (axes['yformat']) {
      axes_param = axes_param + '&yformat=' + escape(encodeURI(axes['yformat']));
    } else {
      axes_param = axes_param + '&yformat=' + escape(encodeURI(DEFAULT_Y_FORMAT));
    } 
    if (axes['yrange']) {
      axes_param = axes_param + '&yrange=' + axes['yrange'];
    } 
    if (axes['ylog']) {
      axes_param = axes_param + '&ylog=' + axes['ylog'];
    }
    if (y2axis_flag) { 
      if (axes['y2label']) {
        axes_param = axes_param + '&y2label=' + escape(encodeURI(axes['y2label']));
      }
      if (axes['y2format']) {
        axes_param = axes_param + '&y2format=' + escape(encodeURI(axes['y2format']));
      } else {
        axes_param = axes_param + '&y2format=' + escape(encodeURI(DEFAULT_Y_FORMAT));
      }
      if (axes['y2range']) {
        axes_param = axes_param + '&y2range=' + axes['y2range'];
      } 
      if (axes['y2log']) {
        axes_param = axes_param + '&y2log=' + axes['y2log'];
      }
    }
    return axes_param;
}
/*
  Returns the key params.
*/ 
function getKeyParams(key) {
  var key_param=''; 
  key_param = key_param + '&key=' + ( key['key'] || DEFAULT_KEY+' '+DEFAULT_BOX );
  if (key['nokey']) {
    key_param = key_param + '&nokey=' + key['nokey'];
  } 
  return key_param;
}

/*
 Returns the style params.
*/
function getStyleParams(style,smooth) {
  var style_param='';
  if (style['smooth'] || (smooth!=null)) {
    style_param = style_param + '&smooth=' + (smooth || style['smooth']);
  } 
  if (style['grid']) {
    style_param = style_param + '&grid=' + style['grid'];
  }
  if (style['flip']) {
    style_param = style_param + '&flip=' + style['flip'];
  }
  if (style['outstyle']) {
    style_param = style_param + '&outstyle=' + style['outstyle'];
  }
  return style_param;
}
/*
  Returns the downsampling interval
*/
function getDownsampleDuration(ds) {
  var ds_duration = ds;
  if (ds_duration < 60 ) {
    ds_duration = parseInt(ds_duration) +'m-'+UNIT;
  } else if (ds_duration >=60 && ds_duration <1440) {
    ds_duration = parseInt(Math.ceil(ds_duration/60)) +'h-'+UNIT;
  } else if (ds_duration >= 1440 && ds_duration < 10080) {
    ds_duration = parseInt(Math.ceil(ds_duration/1440)) +'d-'+UNIT;
  } else if (ds_duration >= 10080 && ds_duration < 43200) {
    ds_duration = parseInt(Math.ceil(ds_duration/10080)) +'w-'+UNIT;
  } else if (ds_duration >= 43200 && ds_duration < 525600) {
    ds_duration = parseInt(Math.ceil(ds_duration/43200)) +'M-'+UNIT;
  } else {
    ds_duration = parseInt(Math.ceil(ds_duration/43200)) +'y-'+UNIT;
  }
  return ds_duration;
}
/*
  Returns tag,value pair for a given metric.
*/
function getTagValue(datastream_objects,fval1,fval2) {
  var tag_objects;
  var tagval = '';
  var tagkey ='';
  var tagValueStrg = '';
  var fval1_flag = fval1 ? 1:0;
  var fval2_flag = fval2 ? 1:0;
     
  for (var l=0; l < datastream_objects['tags'].length; l++) {  
    tag_objects = datastream_objects['tags'][l];
    tagkey = tag_objects['tagkey'];
    tagval = tag_objects['tagvalue'];
    /*
     For Sclass and DC, if the value is specified in the tagvalue, then the value will get higher precendence.
    */
    if (tagkey == tsdb_filter['FILTER1']) {
      fval1_flag = 0;
      tagval = tag_objects['tagvalue'] || fval1 ;
    }

    if (tagkey == tsdb_filter['FILTER2']) {
      fval2_flag = 0;
      tagval = tag_objects['tagvalue'] || fval2 ;
    }

    if (tagval != '') {  // not writing if tagval is empty
      if (tagValueStrg == '') {
        tagValueStrg = tagkey+'='+tagval;
      } else {
        tagValueStrg = tagValueStrg + ',' + tagkey+'='+tagval;
      }
    }
  }
  if (fval1_flag==1) {
    if (tagValueStrg == '') {
      tagValueStrg = tsdb_filter['FILTER1']+'='+fval1;
    } else {
      tagValueStrg = tagValueStrg + ','+tsdb_filter['FILTER1']+'='+fval1;
    }
  }
  if (fval2_flag==1) {
    if (tagValueStrg == '') {
      tagValueStrg = tsdb_filter['FILTER2']+'='+fval2;
    } else {
      tagValueStrg = tagValueStrg + ','+tsdb_filter['FILTER2']+'='+fval2;
    }
  }
  return tagValueStrg;
} 

var _public = {
  create: function() {
  setClock($('#time'));
       
  var url = decodeURIComponent(getURLParam('url'));
  var options = $('#url').prop('options');
  $.get(DASHBOARDS_DIR + '/', function(data) {
    $('a', $(data)).each(function(i, link) {
      if (link.href.endsWith('.json')) {
        var parts = link.href.split('/');
        var name = parts[parts.length-1];
        options[options.length] = new Option(name, name);
      }
    });

    $('#url').val(url);
    if (!url || url == 'null') {
      return;
    }

    var target = DASHBOARDS_DIR + '/' + url + '?_salt=' + new Date().getTime();
    var t = setTimeout('location.reload(true);', 15000);
    $('#footer').html('Refreshes every 15s.');
    $.getJSON(target, function(data) {
      var fval1 = getURLParam('fval1') || data['dashboard_properties'][tsdb_filter['FILTER1']] || DEFAULT_FILTER1;
      var from = data['dashboard_properties']['start_time'] || DEFAULT_FROM;
      var fval2 = getURLParam('fval2') || data['dashboard_properties'][tsdb_filter['FILTER2']] || DEFAULT_FILTER2;
      var smooth = getURLParam('smooth');
      var flip = getURLParam('flip');
      buildGraphs(fval1, from, data,fval2,smooth,flip);
      $('#url').val(url);
      $('#from').val(from);
      $('#fval1').val(fval1).focus().select();
      $('#fval2').val(fval2).focus().select();
      if (smooth!=null) {
        $('#smooth').attr('checked',true);
      }
      if (flip!=null) {
        $('#flip').attr('checked',true);
      }
      // Reset the timeout with the configured timeout (if present)
      if (data['dashboard_properties']['refresh']) {
        clearTimeout(t);
        setTimeout('location.reload(true);', data['dashboard_properties']['refresh']);
      }

      // Build footer text
      var footer = 'Refreshes every ' + Math.round(data['dashboard_properties']['refresh']/1000) + 's.';
      if (data['dashboard_properties']['info']) {
        if (data['dashboard_properties']['info']['author']) {
          footer += ' Dashboard by ' + data['dashboard_properties']['info']['author'];
        }
        if (data['dashboard_properties']['info']['team']) {
          footer += ' for ' + data['dashboard_properties']['info']['team'];
        }
      }

      $('#footer').text(footer);
      }).error(function() {
        $('#footer').addClass('error').text('Error loading dashboard from ' + target + ' !');
        $('#url').val(url).focus();
        $('#from').val(getURLParam('from') || DEFAULT_FROM);
        $('#fval1').val(getURLParam('fval1') || DEFAULT_FILTER1);
      });
   });
  },

  /**
   * Change to another dashboard from the dropdown.
   *
   * Resets the datacenter and from time to their defaults (empty, so the
   * default in the dashboard description is used) and submits the form.
   */
  change: function(picker) {	
    $('#fval1').val('');
    $('#fval2').val('');
    $('#from').val('');
    $('#smooth').val('');
    $('#flip').val('');
    picker.form.submit();
  },
  };
  return _public;
})(jQuery);
