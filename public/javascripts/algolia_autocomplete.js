$(document).ready(function() {
  var client = algoliasearch(algolia_params.app_id, algolia_params.api_key);
  var product_index = client.initIndex(algolia_params.products_index);
  var category_index = client.initIndex(algolia_params.categories_index);
  var hitsSource = autocomplete.sources.hits(category_index, { hitsPerPage: 5 });
  $('#header-search-input').autocomplete(
    {
      debug: true,
      dropdownMenuContainer: '#header-search-hit-dropdown',
      templates: {
        dropdownMenu: $('#header-search-hit-content').html()
      },
      cssClasses: {
        "dropdownMenu": "dropdown-menu header-dropdown-menu container"
      }
    },
    [
      {
        source: autocomplete.sources.hits(product_index, { hitsPerPage: 3 }),
        displayKey: 'name',
        name: 'product',
        cssClasses: {
          suggestions:"",
          suggestion: " product-search-list",
        },
        templates: {
          header: function(query, result) {
            return search_template_title($('#header-search-product-title'), result)
                  +"<div class='row row-same-height'>";
          },
          footer:  function(query, result) {
            return "</div>"
                  + search_template_link($('#header-search-product-link'), query, result)
                  + search_template_history($('#header-search-history'));
          },
          empty: $('#header-search-product-empty').html(),

          suggestion: function(suggestion) {
            suggestion.last_categorie = suggestion.categories[suggestion.categories.length-1];
            suggestion.price = suggestion.price[default_role];
            var product_html = $('#product-hit-template').html().replace('product-thumbnail grid', 'product-thumbnail list');
            var template = Hogan.compile(product_html);
            suggestion.helpers = hogan_helpers;
            return template.render(suggestion);
          }
        }
      },
      {
        source: function(query, callback) {
          hitsSource(query, function(suggestions) {
            var categories = [];
            suggestions = suggestions.map(function(suggestion) {
              if(categories.includes(suggestion.name) == false) {
                categories.push(suggestion.name);
                return suggestion;
              }
              return false;
            });

            callback(suggestions);
          });
        },
        displayKey: 'name',
        name: 'category',
        cssClasses: {
          suggestions:" row",
          suggestion: " col-12",
        },
        templates: {
          header: function(query, result){
            return search_template_title($('#header-search-category-title'), result);
          },
          empty: $('#header-search-category-empty').html(),
          suggestion: function(suggestion) {
            var template = Hogan.compile($('#category-hit-template').html());
            suggestion.helpers = hogan_helpers;
            return template.render(suggestion)
          }
        }
      }
    ]
  );
  $('form.search-form').on('submit', function(e) {
    e.preventDefault();
    var search_query = $(this).find('#header-search-input').val();
    if (search_query != '') {
      var last_queries = JSON.parse(Cookie.get('search_queries'));
      if(last_queries == null) {
        last_queries = [];
      }
      if(last_queries.indexOf(search_query) == -1 ) {
        last_queries.push(search_query);
        Cookie.set('search_queries', JSON.stringify(last_queries));
      }
      $(this)[0].submit();
    }
  });
  $('#header-search-input').on('autocomplete:opened',function(e) {
    $menu = $('.aa-dropdown-menu');

    var window_size = $(window).width() - 50 ;

    var menu_maxoffset = $menu.outerWidth(true) + parseInt($(this).offset().left);
    if(menu_maxoffset > window_size){
      $menu.css('left', (window_size - menu_maxoffset)+'px');
    }
  });
  $('body').click(function(element){
    if($(element.target).parents('.algolia-autocomplete').length == 0) {
      $('#header-search-input').autocomplete('close');
    }
  });
  $('.algolia-autocomplete').on('click', '.btn-history-clear', function(event) {
    $queries_history = $(this).parents('.queries-history');
    $queries_history.hide();
    $queries_history.find('.items').empty();
    Cookie.erase('search_queries');
  });
});

$('#header-search-input').on('focus', function(){
  $(this).autocomplete('open');
});

var hogan_helpers = {
  "emphasis": function() {
    return function(text, render) {
      if(typeof(renders) == 'function') {
        var value = parseInt(render(text));
      }
      else {
        var value = parseInt(hogan_render(text, this));
      }
      return '<em>' + value + '</em>';
    }
  },
  "currency": function() {
    return function(text, render) {
      var n = 0;
      if(typeof(render) != 'undefined') {
        var value = render(text).trim();
        n = new Number(value);
      }
      else if (typeof(hogan_render) != 'undefined') {
        n = new Number(hogan_render(text, this));
      }
      else {
        var text = text.trim();
        if(isNaN(text)) {
          return text;
        }
        else {
          n = new Number(text);
        }
      }
      var currency = currencies.items[currencies.selected];
      var price = n*currency.rate;
      return price.toLocaleString(
        currencies.selected,
        {
          style: "currency",
          currency: currencies.selected,
        }
      );
    }
  },
  "imageDefault": function() {
    return function(text, render) {

      if(typeof(render) == 'function') {
        var url = render(text).trim();
      }
      else {
        var url = hogan_render(text, this).trim();
      }

      if(url != '') {
        return url;
      }
      else {
        return default_img_url;
      }
    }
  },
  "ratingsStars": function() {
    return function(text, render) {
      var html = '';
      if(typeof(render) == 'function') {
        var value = parseInt(render(text));
      }
      else {
        var value = parseInt(hogan_render(text, this));
      }
      if(isNaN(value)) {
        return '&nbsp;';
      }
      var n = 1;
      for(n; n <= 5; n++){
        if(n <= value) {
          html += '<i class="fas fa-star" aria-hidden="true"></i>';
        }
        else {
          html += '<i class="far fa-star" aria-hidden="true"></i>';
        }
      }
      return '<div class="rating">'+html+'</div>';
    }
  }
}

function search_template_link($template, query, result) {
  if(result.nbHits > 1) {
    $template.find('.nb_hits').html(' ('+result.nbHits+')');
    return $template.html();
  }
  else {
    return '';
  }
}

function search_template_history($template) {
  var last_queries = JSON.parse(Cookie.get('search_queries'));
  var $items = $template.find('.items');
  $items.empty();
  var search_path = $items.data('href');
  if(last_queries != null && last_queries.length > 0) {
    for(var i in last_queries) {
      var $item_query = $('<a>').html(last_queries[i]).attr('href', $items.data('href')+'?q='+last_queries[i]);
      $item_query.appendTo($items);
    }
    return $template.html();
  }
  else {
    return '';
  }
}

function search_template_title(template, result) {
  if(typeof(result) != 'undefined') {
    if(result.nbHits > 0) {
      template.find('.nb_hits').html(' ('+result.nbHits+')');
    }
    else {
      template.find('.nb_hits').empty();
    }
  }
  return template.html();
}

function hogan_render(text, data) {
  return Hogan
          .compile(text.replace('<%', '{{').replace('%>', '}}'))
          .render(data);
}