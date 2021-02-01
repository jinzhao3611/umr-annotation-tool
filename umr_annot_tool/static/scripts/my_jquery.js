$(document).ready(function(){
    //https://raw.githubusercontent.com/bartaz/sandbox.js/master/jquery.highlight.js
    jQuery.extend({
        highlight: function (node, re, nodeName, className) {
            if (node.nodeType === 3) {
                var match = node.data.match(re);
                if (match) {
                    var highlight = document.createElement(nodeName || 'span');
                    highlight.className = className || 'highlight';
                    var wordNode = node.splitText(match.index);
                    wordNode.splitText(match[0].length);
                    var wordClone = wordNode.cloneNode(true);
                    highlight.appendChild(wordClone);
                    wordNode.parentNode.replaceChild(highlight, wordNode);
                    return 1; //skip added node in parent
                }
            } else if ((node.nodeType === 1 && node.childNodes) && // only element nodes that have children
                    !/(script|style)/i.test(node.tagName) && // ignore script and style nodes
                    !(node.tagName === nodeName.toUpperCase() && node.className === className)) { // skip if already highlighted
                for (var i = 0; i < node.childNodes.length; i++) {
                    i += jQuery.highlight(node.childNodes[i], re, nodeName, className);
                }
            }
            return 0;
        }
    });
    jQuery.fn.unhighlight = function (options) {
        var settings = { className: 'highlight', element: 'span' };
        jQuery.extend(settings, options);

        return this.find(settings.element + "." + settings.className).each(function () {
            var parent = this.parentNode;
            parent.replaceChild(this.firstChild, this);
            parent.normalize();
        }).end();
    };
    jQuery.fn.highlight = function (words, options) {
        console.log("I am here at jquery highlight1");
        var settings = { className: 'highlight', element: 'span', caseSensitive: false, wordsOnly: false };
        jQuery.extend(settings, options);

        if (words.constructor === String) {
            words = [words];
        }
        words = jQuery.grep(words, function(word, i){ //filter word that is not empty
            console.log(word);
          return word !== '';
        });
        words = jQuery.map(words, function(word, i) {
          return word.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        });
        if (words.length === 0) {return this; };

        var flag = settings.caseSensitive ? "" : "i";
        var pattern = "(" + words.join("|") + ")";
        if (settings.wordsOnly) {
            pattern = "\\b" + pattern + "\\b";
        }
        var re = new RegExp(pattern, flag);

        return this.each(function () {
            console.log(this);
            jQuery.highlight(this, re, settings.element, settings.className);
        });
    };

    $('#childArg').keyup(function (){
        $('#content').unhighlight({element: 'span', className:'text-danger'});
        $('#content').highlight($(this).val(), {element: 'span', className:'text-danger'});
    })
    $('#parentArg').keyup(function (){
        $('#content').unhighlight({element: 'span', className:'text-primary'});
        $('#content').highlight($(this).val(), {element: 'span', className:'text-primary'});
    })
    // $('#content').highlight('s1t', {element: 'span', className:'text-danger'});
    // $('#content').highlight('s2d', {element: 'span', className:'text-primary'});



    $( "#submit-doc-rel" ).click(function() { // when click submit
        $('#umrs').filter(function (){ // find umrs div
            return this.id.match(/amr\d+/); // find id that looks like amr1 amr2
        }).find("span").each(function(index) { // find span
            var text = $(this).text();//get span content
            $(this).replaceWith(text);//replace all span with just content
        });
        $('#parentArg').val(''); // clear input
        $('#childArg').val(''); // clear input
        $('#doc-level-relations').empty(); //clear input
        // docUMR2db();
    });

});

