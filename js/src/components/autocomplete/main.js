define([
    'jquery',
    './typeahead'
], function ($) {


    var qcUrl = "http://193.44.77.246/suggest?site=electrolux_se&client=default_frontend&access=p&max=10&format=rich&callback=?&q=%QUERY";
    var searchFieldSelector = '.nav-search [type="search"], .search-field [type="search"]';

    $(function () {
        $(searchFieldSelector).each(function (i, el) {
            if (qcUrl) {

                var suggestions = new Bloodhound({
                    datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
                    queryTokenizer: Bloodhound.tokenizers.whitespace,
                    remote: {
                        url: qcUrl,
                        filter: function(suggestions) {
                            return $.map(suggestions.results, function(item) { return { name: item.name }; });
                        }
                    }
                });

                suggestions.initialize();

                $(searchFieldSelector).typeahead({
                    hint: false,
                    highlight: true,
                    minLength: 1
                },{
                    name: 'results',
                    displayKey: 'name',
                    source: suggestions.ttAdapter()
                });
            }
        });
    });
});
