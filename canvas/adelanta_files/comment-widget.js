/**
 * @author ankostyuk
 */

// TODO Comment.permision = DELETE - проверить - 
// похоже, что если автор и пользователь X состоят в одной группе, то пользователь X может удалять комментарий.
// Пример: пользователь user6 создал комментарий, модератор одобрил, пользователь user1 при просмотре может удалить комментарий.

/*
Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
*/

// ! https://github.com/n-time/backbone.validations

var CommentWidgetSettings = {
    apiUrl: '/',
    templates: null,
    effects: {
        duration: 100,
        delay: 500
    },
    comments: {
        pageSize: 5
    }
};

var ValidationUtils = {
    
    handleErrors: function(response, el, messageWidget) {
        // Если данное свойство есть в объекте, значит это ошибки клиентской валидации, 
        // иначе response является объектом jqXHR (jQuery jqXHR Object, см. http://api.jquery.com/jQuery.ajax/)
        if ('validateErrors' in response) {
            ValidationUtils.showValidateErrors(response, el);
        } else {
            if (messageWidget) {
                messageWidget.showMessage(CommentUtils.formatRequestErrorMessage(response), 'error');
            }
        }
    },
    
    showValidateErrors: function(response, el) {
        el.addClass('error');
        for (var attr in response['validateErrors']) {
            el.find('.attr-' + attr).addClass('error');
        }
    },
    
    clearValidateErrors: function(el) {
        el.removeClass('error');
        el.find('*[class*="attr-"].error').removeClass('error');
    },
    
    markError: function(el) {
        el.addClass('error');
    },
    
    clearError: function(el) {
        el.removeClass('error');
    }
};

 
/*
 * 
 * params: {
 *      templates: jQuery object,
 *      messageWidget: MessageWidget
 * }
 * 
 */
function CommentBase(params){
    
    //
    var Comment =  Backbone.Model.extend({
        
        url: function() {
            var url = CommentWidgetSettings.apiUrl + '/comments';
            if (this.id) {
                url += '/' + this.id;
            }
            return url;
        },
        
        defaults: {
            scope: {
               visibility: 'PUBLIC'
            }
        },
        
        removeAttachment: function(attachment, options) {
            options = options || {};
            
            var me = this;
            
            $.ajax({
                url: CommentWidgetSettings.apiUrl + '/comments/' + me.id + '/attachment/' + attachment.id,
                type: 'DELETE',
                dataType: 'json',
                success: function(response, textStatus, jqXHR){
                    var attachments = me.get('attachments');
                    
                    if ($.isArray(attachments)) {
                        $.each(attachments, function(index, a) {
                            if (a.id == attachment.id) {
                                attachments.splice(index, 1);
                                return false;
                            }
                        });
                    }
                    
                    if ($.isFunction(options.success)) {
                        options.success.call(me, me, attachment, response);
                    }
                    
                    me.trigger('removeAttachment', me, attachment);
                },
                error: function(jqXHR, textStatus, errorThrown){
                    if ($.isFunction(options.error)) {
                        options.error.call(me, me, attachment, jqXHR);
                    }
                }
            });
        },
        
        fetchShareGroups: function(options) {
            options = options || {};
            
            var me = this;
            
            var userId = me.get('authorId');
            
            if (userId && CommentUtils.hasUserPermission('EDIT_SCOPE')) {
                $.ajax({
                    url: CommentWidgetSettings.apiUrl + '/users/' + userId + '/info/share-groups',
                    type: 'GET',
                    dataType: 'json',
                    success: function(response, textStatus, jqXHR){
                        me.shareGroups = $.isArray(response) ? response : [];
                        
                        if ($.isFunction(options.success)) {
                            options.success.call(me, me, me.shareGroups, response);
                        }
                        
                        me.trigger('fetchShareGroups', me, me.shareGroups);
                    },
                    error: function(jqXHR, textStatus, errorThrown){
                        if ($.isFunction(options.error)) {
                            options.error.call(me, me, jqXHR);
                        }
                    }
                });
            } else {
                me.shareGroups = $.isArray(CommentUtils.USER_INFO.shareGroups) ? CommentUtils.USER_INFO.shareGroups : [];
                if ($.isFunction(options.success)) {
                    options.success.call(me, me, me.shareGroups, CommentUtils.USER_INFO.shareGroups);
                }
                me.trigger('fetchShareGroups', me, me.shareGroups);
            }
        },
        
        validate: function(attrs) {
            // ! В объекте attrs может присутствовать как Comment,
            // так и response при загрузке коллекции, в которой model == Comment
            if (attrs.id && attrs.comments) {
                return;
            }
            
            // {
            //  ...
            //  validateErrors: {
            //      <attrName>: {
            //          // Здесь добавим сообщение, ...
            //      }
            //  }
            // }
            var validateErrors = {};
            
            // content
            if ('content' in attrs) {
                if ($.trim(attrs.content) == '') {
                    validateErrors['content'] = {};
                }
            }
            
            // scope
            if ('scope' in attrs) {
                // shareGroups
                if (attrs.scope.visibility == 'GROUP') {
                    if (attrs.scope.shareGroups.length < 1) {
                        validateErrors['scope-shareGroups'] = {};
                    }
                }
            }
                        
            if (!$.isEmptyObject(validateErrors)) {
                return {
                    validateErrors: validateErrors
                };
            }
        }
    });
    
    //
    var CommentList = Backbone.Collection.extend({
        model: Comment,
        url: CommentWidgetSettings.apiUrl + '/comments/paginated-by-post.json',
        
        paginatedResult: {},
        
        initialize: function() {
            this.bind('add', this.attach, this);
            this.bind('destroy', this.detach, this);
        },
        
        attach: function(comment) {
            this.fetchFirst(comment.get('postId'), $.proxy(this.onFetchError, this));
        },
        
        detach: function(comment) {
            var pageNumber = 1;
            
            if (this.length < 1 && this.isLast() && this.paginatedResult.pageNumber) {
                pageNumber = this.paginatedResult.pageNumber - 1;
            }
            else if (this.paginatedResult.pageNumber) {
                pageNumber = this.paginatedResult.pageNumber;
            }
            
            this.fetchPage(pageNumber, comment.get('postId'), $.proxy(this.onFetchError, this));
        },
        
        fetchPage: function(pageNumber, postId, error) {
            var me = this;
            var list = new CommentList();
            list.fetch({
                data: {
                    postId: postId,
                    pageNumber: pageNumber,
                    pageSize: CommentWidgetSettings.comments.pageSize
                },
                error: error,
                /*
                    response: {
                        entries: [Comment, ...]
                        firstNumber: Number
                        lastNumber: Number
                        pageCount: Number
                        pageNumber: Number
                        pageSize: Number
                        total: Number
                    }
                 */
                success: function(collection, response) {
                    me.paginatedResult = response || {};
                    var data = me.paginatedResult['entries'] || [];
                    me.reset(data);
                }
            });
        },
        
        fetchFirst: function(postId, error) {
            this.fetchPage(1, postId, error);
        },
        
        fetchPrevious: function(postId, error) {
            if (this.paginatedResult.pageNumber) {
                this.fetchPage(this.paginatedResult.pageNumber - 1, postId, error);
            }
        },
        
        fetchNext: function(postId, error) {
            if (this.paginatedResult.pageNumber) {
                this.fetchPage(this.paginatedResult.pageNumber + 1, postId, error);
            }
        },
        
        isEmpty: function() {
            if (this.paginatedResult.total) {
                return (this.paginatedResult.total < 1);
            }
            return true;
        },
        
        isFirst: function() {
            if (this.paginatedResult.pageNumber) {
                return (this.paginatedResult.pageNumber == 1);
            }
            return true;
        },
        
        isLast: function() {
            if (this.paginatedResult.pageNumber && this.paginatedResult.pageCount) {
                return (this.paginatedResult.pageNumber == this.paginatedResult.pageCount);
            }
            return true;
        },
        
        onFetchError: function(collection, response) {
            this.trigger('fetchError', collection, response);
        }
    });
    
    //
    var AttachmentListView = Backbone.View.extend({
        
        tagName: 'div',
        className: 'attachment-list-view',
        template: _.template(params.templates.filter('#attachment-list-view-template').html()),
        
        render: function(comment) {
            var me = this;
            
            me.comment = comment;
            
            me.comment.unbind('removeAttachment', me._onRemoveAttachment);
            me.comment.bind('removeAttachment', me._onRemoveAttachment, me);
            
            me.$el.html(this.template({
                comment: me.comment.toJSON()
            }));
            
            var attachments = me.comment.get('attachments');
            if ($.isArray(attachments)) {
                var list = me.$el.find('.attachment-list');
                $.each(attachments, function(i, attachment){
                    var attachmentView = new AttachmentView({
                        comment: me.comment,
                        attachment: attachment,
                        messageWidget: me.options.messageWidget
                    });
                    list.append(attachmentView.$el);
                });
            }
            
            return this;
        },
        
        _onRemoveAttachment: function(comment, attachment) {
            if ($.isFunction(this.options.onRemoveAttachment)) {
                this.options.onRemoveAttachment.call(this, comment, attachment);
            }
        }
    });
    
    //
    var AttachmentView = Backbone.View.extend({
        
        tagName: 'div',
        className: 'attachment-view',
        template: _.template(params.templates.filter('#attachment-view-template').html()),
        
        initialize: function() {
            var me = this;
            
            me.comment = me.options.comment;
            me.attachment = me.options.attachment;
            
            me.comment.bind('removeAttachment', me._onRemoveAttachment, me);
            
            me.$el.html(me.template({
                comment: me.comment.toJSON(),
                attachment: me.attachment
            }));
        },
        
        events: {
            'click .attachment .download': '_download',
            'click .attachment .detach': '_remove'
        },
        
        _download: function() {
            var me = this;
            CommentUtils.downloadFile({
                url: CommentWidgetSettings.apiUrl + '/comments/' + me.comment.get('id') + '/attachment/' + me.attachment.id + '/' + me.attachment.name,
                responseCallback: function(response) {
                    var s = CommentUtils.getServerErrorMessage(response);
                    var message = s ? s : CommentUtils.Messages.errorDownloadFile;
                    me.options.messageWidget.showMessage(message, 'error');
                }
            });
            return false;
        },
        
        _remove: function() {
            var me = this;
            
            params.messageWidget.confirm(CommentUtils.Messages.confirm['delete.file'], 'warning', {
                yes: function(){
                    me.comment.removeAttachment(me.attachment, {
                        error: function(comment, attachment, response){
                            ValidationUtils.handleErrors(response, null, me.options.messageWidget);
                        }
                    });
                }
            });
        },
        
        _onRemoveAttachment: function(comment, attachment) {
            var me = this;
            if (me.comment.id == comment.id && me.attachment.id == attachment.id) {
                me.$el.fadeOut(CommentWidgetSettings.effects.duration, function(){
                    me.$el.remove();
                    me.unbind();
                });
            }
        }
    });
    
    //
    var ScopeView = Backbone.View.extend({
        
        tagName: 'div',
        className: 'scope-view',
        template: _.template(params.templates.filter('#scope-view-template').html()),
        
        events: {
            'change input': 'onScopeChange'
        },
        
        render: function(comment) {
            var me = this;
            
            me.comment = comment;
            me.scope = me.comment.get('scope');
            
            me.comment.unbind('fetchShareGroups', me._onFetchShareGroups);
            me.comment.bind('fetchShareGroups', me._onFetchShareGroups, me);
            
            // Ожидать получения shareGroups
            me.$el.html(me.template({
                scope: me.scope,
                shareGroups: null
            }));
            
            // Вызвать получение shareGroups и ожидать события 'fetchShareGroups'
            ValidationUtils.clearError(me.$el);
            me.comment.fetchShareGroups({
                error: function(comment, response){
                    ValidationUtils.markError(me.$el);
                    ValidationUtils.handleErrors(response, null, me.options.messageWidget);
                }
            });
            
            return me;
        },
        
        _onFetchShareGroups: function(comment, shareGroups) {
            if (this.comment && this.comment.id == comment.id) {
                this.$el.html(this.template({
                    scope: this.scope,
                    shareGroups: shareGroups
                }));
                
                this.shareGroupsCnt = this.$el.find('.share-groups')//
                    .hide();
                    
                this.check();
            }
        },
        
        check: function() {
            this.visibilityChecked = this.$el.find(':radio:checked'); 
            this.groupChecked = this.$el.find('.share-groups :checkbox:checked');
            
            var groupCbs = this.$el.find('.share-groups :checkbox');
             
            if (this.visibilityChecked.val() == 'GROUP' ) {
                groupCbs.removeAttr('disabled');
                this.shareGroupsCnt.slideDown(CommentWidgetSettings.effects.duration);
            } else {
                groupCbs.attr('disabled', 'disabled');
                this.shareGroupsCnt.slideUp(CommentWidgetSettings.effects.duration);
            }
        },
        
        onScopeChange: function() {
            this.check();
            this.doScope();
            
            if (this.options.saveOnChange) {
                this.doSave();
            }
        },
        
        doScope: function() {
            // TODO пересечение scope.shareGroups и USER_INFO.shareGroups:
            // если scope.shareGroups > USER_INFO.shareGroups ?
            
            this.scope = {};
            
            var visibility = this.visibilityChecked.val();
            
            if (visibility == 'GROUP') {
                var shareGroups = [];
                
                this.groupChecked.each(function() {
                    shareGroups.push($(this).val());
                })
                
                this.scope.shareGroups = shareGroups;
            }
            
            this.scope.visibility = visibility;
        },
        
        doSave: function() {
            this.comment.partialSave({
                scope: this.scope
            }, true, {
                'error': $.proxy(this.onError, this),
                'success': $.proxy(this.onSuccess, this)
            });
        },
        
        onError: function(comment, response) {
            ValidationUtils.handleErrors(response, this.$el, this.options.messageWidget);
            if ($.isFunction(this.options.onError)) {
                this.options.onError.call(this);
            }
        },
        
        onSuccess: function(comment) {
            ValidationUtils.clearValidateErrors(this.$el);
            if ($.isFunction(this.options.onSuccess)) {
                this.options.onSuccess.call(this);
            }
        },
        
        getScope: function() {
            return this.scope;
        }
    });
    
    //
    var ModerateActionView = Backbone.View.extend({
        
        model: Comment,
        
        tagName: 'span',
        className: 'moderate-action-view',
        template: _.template(params.templates.filter('#moderate-action-view-template').html()),
        
        render: function() {
            this.$el.html(this.template({
                moderation: this.model.get('moderation')
            }));
            
            return this;
        }
    });
    
    //
    var ModerateView = Backbone.View.extend({
        
        model: Comment,
        
        tagName: 'div',
        className: 'moderate-view',
        template: _.template(params.templates.filter('#moderate-view-template').html()),
        
        events: {
            'click .approve': 'approve',
            'click .reject': 'reject',
            'click .review': 'review',
            'keydown input.rejection-reason-action': 'rejectionKeypress'
        },
        
        render: function() {
            this.$el.html(this.template({
                moderation: this.model.get('moderation')
            }));
            
            this.rejectionReasonInput = this.$el.find('input.rejection-reason-action').hide();
            
            return this;
        },
        
        approve: function() {
            this.model.partialSave({
                moderation: {
                    status: 'APPROVED'
                }
            }, true, {
                'error': $.proxy(this.onError, this),
                'success': $.proxy(this.onSuccess, this)
            });
        },
        
        reject: function() {
            if (this.rejectionReasonInput.hasClass('active')) {
                var reason = $.trim(this.rejectionReasonInput.val());
                if (reason) {
                    this.model.partialSave({
                        moderation: {
                            status: 'REJECTED', 
                            rejectionReason: reason
                        }
                    }, true, {
                        'error': $.proxy(this.onError, this),
                        'success': $.proxy(this.onSuccess, this)
                    });
                }
                this.rejectionReasonInput.focus();
            } else {
                this.rejectionReasonInput.show().addClass('active').focus();
            }
        },
        
        rejectionKeypress: function(e) {
            if (e.keyCode == 13) {
                this.reject();
            } else if(e.keyCode == 27) {
                this.rejectionCancel();
            }
        },
        
        rejectionCancel: function() {
            this.rejectionReasonInput.removeClass('active').hide();
        },
        
        review: function() {
            this.model.partialSave({
                moderation: {
                    status: 'PENDING'
                }
            }, true, {
                'error': $.proxy(this.onError, this),
                'success': $.proxy(this.onSuccess, this)
            });
        },
        
        onError: function(comment, response) {
            ValidationUtils.handleErrors(response, this.$el, this.options.messageWidget);
            if ($.isFunction(this.options.onError)) {
                this.options.onError.call(this);
            }
        },
        
        onSuccess: function(comment) {
            ValidationUtils.clearValidateErrors(this.$el);
            this.render();
            if ($.isFunction(this.options.onSuccess)) {
                this.options.onSuccess.call(this);
            }
        }
    });
    
    //
    var VerifyActionView = Backbone.View.extend({
        
        model: Comment,
        
        tagName: 'div',
        className: 'verify-action-view',
        template: _.template(params.templates.filter('#verify-action-view-template').html()),
        
        events: {
            'click .verify': 'verify'
        },
        
        render: function() {
            this.$el.html(this.template({
                verification: this.model.get('verification')
            }));
            
            return this;
        },
        
        verify: function() {
            var verified = this.model.get('verification').verified;
            
            this.model.partialSave({
                verification: {
                    verified: !verified
                }
            }, true, {
                'error': $.proxy(this.onError, this),
                'success': $.proxy(this.onSuccess, this)
            });
        },
        
        onError: function(comment, response) {
            ValidationUtils.handleErrors(response, this.$el, this.options.messageWidget);
        },
        
        onSuccess: function(comment) {
            ValidationUtils.clearValidateErrors(this.$el);
            this.render();
        }
    });
    
    //
    var ActionsView = Backbone.View.extend({
        
        actionTabPref: 'action-tab-',

        initialize: function() {
            this.container = this.options.container;
            
            var me = this;
            this.actionTabs = this.container.find('[class*="' + this.actionTabPref + '"]').click(function(){
                var actionTab = $(this);

                var actionTabClass = _.find(actionTab.attr('class').split(' '), function(c){
                    return c.indexOf(me.actionTabPref) === 0;
                });
                
                var action = actionTabClass.replace(me.actionTabPref, '');
                
                var actionPane = me.actionPanes.filter('.' + action);
                
                var activeActionTab = me.actionTabs.filter('.active');
                
                if (activeActionTab.length && !activeActionTab.hasClass(action)) {
                    var activeActionPane = me.actionPanes.filter('.active');
                    
                    activeActionTab.removeClass('active');
                    activeActionPane.removeClass('active');
                    activeActionPane.slideUp(CommentWidgetSettings.effects.duration, function(){
                        actionTab.addClass('active');
                        actionPane.addClass('active');
                        me.doActivatePane(action, actionPane);
                    });
                } else {
                    if (actionTab.hasClass('active')) {
                        actionTab.removeClass('active');
                        actionPane.removeClass('active');
                        actionPane.slideUp(CommentWidgetSettings.effects.duration);
                    } else {
                        actionTab.addClass('active');
                        actionPane.addClass('active');
                        me.doActivatePane(action, actionPane);
                    }
                }
            });
            
            this.actionPanes = this.container.find('.action-pane');
        },
        
        doActivatePane: function(action, actionPane){
            var me = this;
            
            me.activePane = actionPane;
            
            if ($.isFunction(me.options.onBeforeActivatePane)) {
                me.options.onBeforeActivatePane.call(me, action, actionPane);
            }
            
            actionPane.slideDown(CommentWidgetSettings.effects.duration, function(){
                if ($.isFunction(me.options.onActivatePane)) {
                    me.options.onActivatePane.call(me, action, actionPane);
                }
            });
        },
        
        hideActivePane: function(callback){
            var me = this;
            
            me.actionTabs.removeClass('active');
            me.actionPanes.removeClass('active');
            
            if (!me.activePane) {
                return;
            }
            
            me.activePane.slideUp(CommentWidgetSettings.effects.duration, function(){
                if ($.isFunction(callback)) {
                    callback.call(me);
                }
            });
        }
    });
    
    //
    return {
        Comment: Comment,
        CommentList: CommentList,
        AttachmentListView: AttachmentListView,
        ScopeView: ScopeView,
        ModerateActionView: ModerateActionView,
        ModerateView: ModerateView,
        VerifyActionView: VerifyActionView,
        ActionsView: ActionsView
    };
};


function BlankCommentWidget() {

    var _templates = $(CommentWidgetSettings.templates);
    var _t = _.template(_templates.filter('#blank-comment-widget-template').html());
    var _widget = $(_t()).appendTo('body');

    // Backbone
    var WidgetView = Backbone.View.extend({

        visible: false,

        el: _widget,

        events: {
            'click .widget-header .help': 'help',
            'click .widget-header .close': 'close',
            'click .widget-body .registration': 'registration'
        },

        registration: function() {
            window.open("/reg", "_self");
            return false;
        },

        help: function() {
            window.open("/help/comments", "_blank");
            return false;
        },

        close: function() {
            this.hide();
        },

        show: function(left, top) {
            this.visible = true;

            this.$el.css({left: left, top: top}).show();
        },

        hide: function() {
            this.visible = false;
            this.$el.hide();
        },

        isShow: function() {
            return (this.visible);
        },

        getViewEl: function() {
            return this.$el;
        }
    });

    var widget = new WidgetView();

    return {
        show: function(left, top){
            widget.show(left, top);
        },
        hide: function(){
            widget.hide();
        },
        isShow: function(){
            return widget.isShow();
        },
        getWidgetEl: function(){
            return widget.getViewEl();
        }
    };
}

/*
 * 
 * params: {
 *      messageWidget: MessageWidget
 * }
 * 
 */
function CommentWidget(params){
    
    params = params || {};
    
    var _templates = $(CommentWidgetSettings.templates);
    var _t = _.template(_templates.filter('#comment-widget-template').html());
    var _widget = $(_t()).appendTo('body');
    
    //
    var messageWidget = $.type(params.messageWidget) === 'object' ? params.messageWidget : new MessageWidget({
        container: _widget
    });
    
    //
    var commentBase = new CommentBase({
        templates: _templates,
        messageWidget: messageWidget
    });
    
    // Backbone
    var WidgetView = Backbone.View.extend({

        postId:  null,
        visible: false,
    
        el: _widget,

        initialize: function() {
                
            this.commentList = new commentBase.CommentList();
            
            this.commentListView = new CommentListView({
                el: this.$el.find('.comment-list'),
                model: this.commentList
            });
            this.commentListView.bind('edit', this.editComment, this);
            
            this.addCommentBtn = this.$el.find('.add-comment')//
                .click($.proxy(this.toggleAddCommentView, this));
            
            //
            this.addCommentCnt = this.$el.find('.add-comment-cnt')//
                .hide();
                
            this.addCommentWidget = new EditCommentWidget({
                owner: this,
                createMode: true,
                onCancel: this.onAddCommentCancel,
                onPost: this.onAddCommentPost,
                onPartialPost: this.onAddCommentPartialPost,
                messageWidget: messageWidget
            });
            
            // Есть возможность добавлять комментарий (право CREATE)
            if (this.addCommentCnt.length) {
                this.addCommentWidget.getWidgetEl().appendTo(this.addCommentCnt).show();
            } else {
                this.addCommentWidget.getWidgetEl().appendTo(this.$el).hide();
            }         
            
            //
            this.editCommentCnt = this.$el.find('.edit-comment-cnt')//
                .hide();
                
            this.editCommentWidget = new EditCommentWidget({
                owner: this,
                createMode: false,
                onCancel: this.onEditCommentCancel,
                onPost: this.onEditCommentPost,
                messageWidget: messageWidget
            });
            
            // Есть возможность редактировать комментарий (право EDIT)
            if (this.editCommentCnt.length) {
                this.editCommentWidget.getWidgetEl().appendTo(this.editCommentCnt).show();
            } else {
                this.editCommentWidget.getWidgetEl().appendTo(this.$el).hide();
            }         
        },
        
        events: {
            'click .widget-header .help': 'help',
            'click .widget-header .close': 'close'
        },

        help: function() {
            window.open("/help/comments", "_blank");
            return false;
        },
        
        toggleAddCommentView: function() {
            if (this.isAddCommentViewShow()) {
                this.hideAddCommentView(true);
            } else {
                this.showAddCommentView();
            }
        },
        
        isAddCommentViewShow: function() {
            return this.addCommentCnt.hasClass('show');
        },
        
        showAddCommentView: function() {
            this.addCommentWidget.createComment(this.postId);
            
            this.addCommentBtn.addClass('active').removeAttr('disabled');
            this.addCommentCnt.addClass('show').slideDown(CommentWidgetSettings.effects.duration);
        },
        
        hideAddCommentView: function(slide) {
            this.addCommentBtn.removeClass('active').removeAttr('disabled');
            this.addCommentCnt.removeClass('show');
            if (slide) {
                this.addCommentCnt.slideUp(CommentWidgetSettings.effects.duration);
            } else {
                this.addCommentCnt.hide();
            }
            
            this.addCommentWidget.clear(); 
        },
        
        onAddCommentCancel: function() {
            this.toggleAddCommentView();
        },
        
        onAddCommentPartialPost: function() {
            this.addCommentBtn.attr('disabled', 'disabled');
        },
        
        onAddCommentPost: function(comment) {
            this.toggleAddCommentView();
            this.commentList.add(comment);
        },
        
        editComment: function(comment, el) {
            this.hideAddCommentView();
            this.commentListView.$el.slideUp(CommentWidgetSettings.effects.duration);
            this.addCommentBtn.hide();
            
            this.editCommentWidget.editComment(comment);
            this.editCommentCnt.slideDown(CommentWidgetSettings.effects.duration);
        },

        onEditCommentCancel: function() {
            this.hideEditCommentView();
        },
        
        onEditCommentPost: function(comment) {
            this.hideEditCommentView();
        },
        
        hideEditCommentView: function() {
            this.editCommentCnt.slideUp(CommentWidgetSettings.effects.duration);
            
            this.addCommentBtn.show();
            this.commentListView.$el.slideDown(CommentWidgetSettings.effects.duration);
        },
        
        hideMessageWidget: function() {
            messageWidget.clear();
        },
        
        close: function() {
            this.hide();
        },
        
        show: function(left, top, postId) {
            if (!postId) {
                throw 'postId is required';
            }
            
            this.postId = postId;
            
            this.reset();
             
            this.postId = postId;
            this.visible = true;
            
            this.$el.css({left: left, top: top}).show();
            
            this.commentListView.clear();
            this.commentListView.reset(postId);
        },
    
        hide: function() {
            this.reset();
            
            this.visible = false;
            this.$el.hide();
        },
    
        reset: function() {
            this.hideMessageWidget();
            
            this.hideAddCommentView();
            this.addCommentWidget.clear();
            this.hideEditCommentView();
            this.editCommentWidget.clear();
            
            this.postId = null;
        },
    
        isShow: function(postId) {
            return (this.visible && (this.postId == postId));
        },
        
        getViewEl: function() {
            return this.$el;
        }
    });

    var CommentListView = Backbone.View.extend({
        
        fetchFirst: 'fetchFirst',
        fetchPrevious: 'fetchPrevious',
        fetchNext: 'fetchNext',

        initialize: function() {
            this.model.bind('reset', this.onReset, this);
            this.model.bind('fetchError', this.onFetchError, this);
            
            this.comments = this.$el.find('.comments');
            
            this.noCommentsLbl = this.$el.find('.no-comments');
            
            this.moreComments = this.$el.find('.more-comments')//
                .hide();
                
            this.moreCommentsPrev = this.moreComments.find('.prev')//
                .click($.proxy(this.prev, this));
                
            this.moreCommentsNext = this.moreComments.find('.next')//
                .click($.proxy(this.next, this));
                
            // Есть возможность просмотра списка (право VIEW)
            if (this.comments.length) {
                this.noCommentsLbl.hide();
            }
        },
        
        add: function(comment) {
            var view = new CommentView({
                model: comment
            });
            view.bind('edit', this.edit, this);
            this.comments.append(view.render().$el);
        },

        reset: function(postId) {
            this.postId = postId;
            this.fetch(this.fetchFirst);
        },
        
        prev: function() {
            this.fetch(this.fetchPrevious);
        },
        
        next: function() {
            this.fetch(this.fetchNext);
        },
        
        fetch: function(fetch) {
            // Нет возможности просмотра списка (права VIEW)
            if (!this.comments.length) {
                return;
            }
            
            messageWidget.showWait();
            
            var me = this;
            me.comments.slideUp(CommentWidgetSettings.effects.duration, function(){
                if (fetch === me.fetchFirst) {
                    me.model.fetchFirst(
                        me.postId,
                        $.proxy(me.onFetchError, me)
                    );
                } else if (fetch === me.fetchPrevious) {
                    me.model.fetchPrevious(
                        me.postId,
                        $.proxy(me.onFetchError, me)
                    );
                } else if (fetch === me.fetchNext) {
                    me.model.fetchNext(
                        me.postId,
                        $.proxy(me.onFetchError, me)
                    );
                }
            });
        },
        
        onFetchError: function(collection, response) {
            messageWidget.showMessage(CommentUtils.formatRequestErrorMessage(response), 'error');
        },
        
        onReset: function() {
            this.clear();
            
            if (this.model.length > 0) {
                this.model.each(function(comment) {
                    this.add(comment);
                }, this);
            }
            
            messageWidget.hide();
            
            this.comments.slideDown(CommentWidgetSettings.effects.duration);
            
            this.checkStatus();
        },
        
        checkStatus: function() {
            var commentList = this.model;
            
            if (commentList.isEmpty()) {
                this.moreComments.hide();
                this.noCommentsLbl.show();
            } else {
                this.noCommentsLbl.hide();
                
                if (commentList.isFirst() && commentList.isLast()) {
                    this.moreComments.hide();
                } else {
                    this.moreComments.show();
                    if (commentList.isFirst()) {
                        this.moreCommentsPrev.addClass('disabled').attr('disabled', 'disabled');
                    } else {
                        this.moreCommentsPrev.removeClass('disabled').removeAttr('disabled');
                    }
                    if (commentList.isLast()) {
                        this.moreCommentsNext.addClass('disabled').attr('disabled', 'disabled');
                    } else {
                        this.moreCommentsNext.removeClass('disabled').removeAttr('disabled');
                    }
                }
            }
        },
        
        edit: function(comment, el) {
            this.trigger('edit', comment, el);
        },

        clear: function() {
            this.comments.empty();
            this.noCommentsLbl.show();
        }
    });

    //
    var CommentView = Backbone.View.extend({
        
        model: commentBase.Comment,
        tagName: 'div',
        className: 'comment-view',
        template: _.template(_templates.filter('#comment-view-template').html()),
        
        initialize: function() {
            this.model.bind('save', this.onSave, this);
            this.model.bind('removeAttachment', this._onRemoveAttachment, this);
        },

        events: {
            'click .action.edit': 'edit',
            'click .action.delete': 'remove'
        },
        
        render: function() {
            this.$el.html(this.template({
                comment: this.model.toJSON()
            }));
            
            this.wrapper = this.$el.find('.wrapper');

            //
            this.attachmentListView = new commentBase.AttachmentListView({
                messageWidget: messageWidget
            });
            this.attachmentListView.render(this.model);
            this.$el.find('.action-pane.attachments').html(this.attachmentListView.$el);
            
            //
            this.scopeAction = this.$el.find('.scope.action');
            this.scopeView = new commentBase.ScopeView({
                saveOnChange: true,
                messageWidget: messageWidget,
                onError: $.proxy(this.onScopeChangeError, this),
                onSuccess: $.proxy(this.onScopeChangeSuccess, this)
            });
            // Не отрисовывать scope - будет отрисован при открытии панели scope
            //this.scopeView.render(this.model);
            this.$el.find('.action-pane.scope').html(this.scopeView.$el);
            
            //
            this.moderateActionTab = this.$el.find('.moderate.action');
            this.moderateActionView = new commentBase.ModerateActionView({
                model: this.model
            });
            this.$el.find('.moderate-action-view').replaceWith(this.moderateActionView.$el);
            this.moderateActionView.render();
            this.moderateView = new commentBase.ModerateView({
                model: this.model,
                messageWidget: messageWidget,
                onSuccess: $.proxy(this.onModerateSuccess, this)
            });
            this.moderateView.render();
            this.$el.find('.action-pane.moderate').html(this.moderateView.$el);
            
            //            
            this.verifyActionView = new commentBase.VerifyActionView({
                model: this.model,
                messageWidget: messageWidget
            });
            this.verifyActionView.render();
            this.$el.find('.verify-action-view').replaceWith(this.verifyActionView.$el);
            
            //
            this.actionsView = new commentBase.ActionsView({
                container: this.$el,
                onBeforeActivatePane: $.proxy(this.onBeforeActivateActionsPane, this)
            });
            
            return this;
        },
        
        onSave: function(comment, fetch) {
            if (fetch) {
                this.model.fetch({
                    'error': $.proxy(this.onFetchError, this),
                    'success': $.proxy(this.onFetchSuccess, this)
                });
            } else {
                this.render();
            }
        },

        onFetchError: function(comment, response) {
            messageWidget.showMessage(CommentUtils.formatRequestErrorMessage(response), 'error');
        },
        
        onFetchSuccess: function(comment, response) {
            this.render();
        },
        
        edit: function() {
            this.trigger('edit', this.model, this.$el);
        },
        
        remove: function() {
            var me = this;
            
            messageWidget.confirm(CommentUtils.Messages.confirm['delete.comment'], 'warning', {
                yes: function(){
                    me.$el.slideUp(CommentWidgetSettings.effects.duration, function(){
                        me.model.destroy({
                            'error': $.proxy(me.onRemoveError, me),
                            'success': $.proxy(me.onRemoveSuccess, me)
                        });
                    });
                }
            });
        },
        
        onRemoveError: function(comment, response) {
            this.$el.slideDown(CommentWidgetSettings.effects.duration, function(){
                messageWidget.showMessage(CommentUtils.formatRequestErrorMessage(response), 'error');
            });
        },
        
        onRemoveSuccess: function(comment, response) {
            this.scopeView.unbind();
            this.$el.remove();
            this.unbind();
        },
        
        onBeforeActivateActionsPane: function(action, actionPane) {
            if (action == 'scope') {
                this.scopeView.render(this.model);                
            }
        },
        
        onScopeChangeError: function() {
            ValidationUtils.showValidateErrors({}, this.scopeAction);
        },
        
        onScopeChangeSuccess: function() {
            ValidationUtils.clearValidateErrors(this.scopeAction);
            
            if (this.scopeView.getScope().visibility == 'PRIVATE') {
                this.wrapper.addClass('private');
            } else {
                this.wrapper.removeClass('private');
            }
        },
        
        onModerateSuccess: function() {
            var me = this;
            me.actionsView.hideActivePane(function(){
                me.render();
            });
        },
        
        _onRemoveAttachment: function(comment, attachment) {
            var me = this;
            var attachments = me.model.get('attachments');
            if ($.isArray(attachments) && attachments.length < 1) {
                _.delay(function(){
                    me.render();
                }, CommentWidgetSettings.effects.duration);
            }
        }
    });

    var widget = new WidgetView();
    //
    
    // API
    return {
        show: function(left, top, postId){
            widget.show(left, top, postId);
        },
        hide: function(){
            widget.hide();
        },
        isShow: function(postId){
            return widget.isShow(postId);
        },
        getWidgetEl: function(){
            return widget.getViewEl();
        }
    };
};

/*
 * 
 * params: {
 *      owner: Object,
 *      createMode: Boolean,
 *      onCancel: Function,
 *      onPost: Function(Comment),
 *      onPartialPost: Function(Comment),
 *      messageWidget: MessageWidget
 * }
 * 
 */
function EditCommentWidget(params){
    
    params = params || {};
    
    var _templates = $(CommentWidgetSettings.templates);
    var _widget = $(_templates.filter('#edit-comment-widget-template').html()).appendTo('body');
    
    var createMode = params.createMode || false;
    
    //
    var messageWidget = $.type(params.messageWidget) === 'object' ? params.messageWidget : new MessageWidget({
        container: _widget
    });

    //
    var commentBase = new CommentBase({
        templates: _templates,
        messageWidget: messageWidget
    });
    
    // Backbone 
    var WidgetView = Backbone.View.extend({

        el: _widget,

        initialize: function() {
            this.editor = this.$el.find('.editor');
            
            this.cancelBtn = this.$el.find('.cancel')//
                .hide();
            this.closeBtn = this.$el.find('.hide')//
                .hide();
            
            //
            if (!createMode) {
                this.attachmentListView = new commentBase.AttachmentListView({
                    messageWidget: messageWidget,
                    onRemoveAttachment: $.proxy(this._onRemoveAttachment, this)
                });
                this.$el.find('.attachment-list-view').replaceWith(this.attachmentListView.$el);
            }
            
            //
            this.newAttachmentListView = new NewAttachmentListView({
                ownerView: this,
                el: this.$el.find('.attachment-list.new')
            });
            
            //
            this.scopeView = new commentBase.ScopeView({
                messageWidget: messageWidget
            });
            this.$el.find('.scope-view').replaceWith(this.scopeView.$el);
        },
        
        events: {
            'click .post': 'doPost',
            'click .cancel': 'cancel',
            'click .hide': 'close'
        },
        
        doPost: function() {
            this.clearValidation();
            
            if (!this.comment) {
                throw 'No comment for action';
            }
            
            var attrs = {
                content: $.trim(this.editor.val()),
                scope: this.scopeView.getScope()
            };
            var options = {
                'error': $.proxy(this.onError, this),
                'success': $.proxy(this.onSuccess, this)
            };

            if (createMode) {
                this.comment.save(attrs, options);
            } else {
                this.comment.partialSave(attrs, true, options);
            }
        },
        
        onError: function(comment, response) {
            ValidationUtils.handleErrors(response, this.$el, messageWidget);
        },
        
        onSuccess: function(comment) {
            this.clearValidation();
            
            this.newAttachmentListView.send(
                comment,
                $.proxy(this.onFilesSendComplete, this));
        },
        
        onFilesSendComplete: function(comment, hasErrors, successCount) {
            comment.trigger('save', comment, successCount ? true : false);
            
            if (hasErrors) {
                this.showClose();
                if ($.isFunction(params.onPartialPost)) {
                    params.onPartialPost.call(params.owner, comment);
                }
            } else {
                if ($.isFunction(params.onPost)) {
                    params.onPost.call(params.owner, comment);
                }
            }
        },
        
        _onRemoveAttachment: function(comment, attachment) {
            this.showClose();
        },
        
        cancel: function() {
            this.clearValidation();
            
            if ($.isFunction(params.onCancel)) {
                params.onCancel.call(params.owner);
            }
        },
        
        close: function() {
            this.clearValidation();
            
            if ($.isFunction(params.onPost)) {
                params.onPost.call(params.owner, this.comment);
            }
        },
        
        clear: function() {
            this.postId = null;
            
            this.comment = null;
            this.commentPrev = null;
            
            this.editor.val('');
            this.newAttachmentListView.clear();
            this.clearValidation();
            
            //
            this.showCancel();
        },
        
        showCancel: function() {
            this.closeBtn.hide();
            this.cancelBtn.show();
        },
        
        showClose: function() {
            this.cancelBtn.hide();
            this.closeBtn.show();
        },
        
        clearValidation: function() {
            ValidationUtils.clearValidateErrors(this.$el);
        },
        
        createComment: function(postId) {
            if (!postId) {
                throw 'postId is required';
            }
            
            this.clear();
            
            if (!createMode) {
                throw 'Not in create mode';
            }
            
            this.postId = postId;
            this.comment = new commentBase.Comment();
            
            this.comment.set({
                postId: this.postId
            }, {
                silent: true
            });
            
            //
            this.renderScope();
        },
        
        editComment: function(comment) {
            if (!comment) {
                throw 'comment is required';
            }
            
            this.clear();
            
            if (createMode) {
                throw 'Not in edit mode';
            }
            
            // TODO template
            this.editor.val(comment.get('content'));
            
            this.comment = comment;
            this.commentPrev = comment.clone();
            
            //
            this.renderAttachments();
            this.renderScope();
        },
        
        renderScope: function() {
            this.scopeView.render(this.comment);
        },
        
        renderAttachments: function() {
            this.attachmentListView.render(this.comment);
        },
        
        getViewEl: function() {
            return this.$el;
        }
    });

    //
    var NewAttachmentListView = Backbone.View.extend({
        
        sending: false,

        initialize: function() {
            this.fileUploadSelector = '.attach-file-upload';
            this.fileInputSelector = '.attach-file input.active';
            
            this.attachFileCnt = this.$el.find('.attach-file');
            
            this.attachments = this.$el.find('.attachments');
            
            this.initUpload();
        },
        
        getFileUpload: function() {
            return this.$el.find(this.fileUploadSelector);
        },
        
        getFileInput: function() {
            return this.$el.find(this.fileInputSelector);
        },
        
        initUpload: function() {
            var me = this;
            
            me.filesData = [];
            
            me.getFileUpload().fileupload({
                // dropZone: $(me.options.ownerView.el), // Disable drag & drop files. Uncomment this line for enable drag & drop files.
                dropZone: null,
                replaceFileInput: false,
                fileInput: me.getFileInput(),
                add: function (e, data){
                    $.each(data.files, function(index, file){
                        me.addFile(file);
                    });
                },
                paste: function (e, data){
                    // Default DOM paste event
                    return true;
                }
            });
        },
        
        addFile: function(file) {
            if (this.sending) {
                return;
            }
            
            var fileInput = this.getFileInput();
            var fileInputNew = fileInput.clone().appendTo(this.attachFileCnt);
            fileInput.removeClass('active');
            
            this.getFileUpload().fileupload('option', {
                fileInput: fileInputNew
            });
            
            var newAttachmentView = new NewAttachmentView({
                file: file
            });
            newAttachmentView.bind('onRemove', this.onNewAttachmentViewRemove, this);

            
            this.filesData.push({
                id: newAttachmentView.cid,
                file: file,
                fileInput: fileInput,
                view: newAttachmentView
            });
            
            this.attachments.append(newAttachmentView.render().$el);
        },
        
        removeFile: function(id) {
            var me = this;
            
            $.each(me.filesData, function(index, fileData) {
                if (fileData.id == id) {
                    me.clearFileData(fileData);
                    me.filesData.splice(index, 1);
                    return false;
                }
            });
        },
        
        clearFileData: function(fileData) {
            fileData.fileInput.remove();
        },
        
        onNewAttachmentViewRemove: function(view) {
            this.removeFile(view.cid);
        },
        
        getFileName: function(fileData) {
            var originalName = $.trim(fileData.file.name);
            var viewName = $.trim(CommentUtils.normalizeFileName(fileData.view.getFileName()));
            
            if (!viewName) {
                return originalName;
            }
            
            var originalExt = CommentUtils.getFileNameExtension(originalName);
            var viewExt = CommentUtils.getFileNameExtension(viewName);
            
            if (originalExt && originalExt != viewExt) {
                return (viewName + originalExt);
            }
            
            return viewName;
        },
        
        send: function(comment, completeCallback) {
            var me = this;
            
            if (me.sending) {
                return false;
            }
            
            me.comment = comment;
            me.completeCallback = completeCallback;
            me.hasErrors = false;
            me.sending = true;
            me.sendCount = 0;
            me.filesDataSuccess = [];
            
            if (me.filesData.length < 1) {
                me.sending = false;
                me.completeCallback.call(me, me.comment, me.hasErrors, 0);
                return true;
            }
            
            messageWidget.showWait();
            
            me.sendFile(0);
            
            return true;
        },
        
        sendFile: function(index) {
            var me = this;
            
            _.defer(function(){
                var fileData = me.filesData[index];
                
                me.getFileUpload().fileupload('send', {
                    url: CommentWidgetSettings.apiUrl + '/comments/' + me.comment.get('id') + '/attachment',
                    dataType: 'json',
                    sequentialUploads: false,
                    forceIframeTransport: false,
                    files: [fileData.file],
                    fileInput: fileData.fileInput,
                    formData: {
                        name: me.getFileName(fileData)
                    }
                })//
                .success(function(result, textStatus, jqXHR){
                    if (!result || CommentUtils.hasError(result)) {
                        me.onFileSendError(index, fileData, result);
                    } else {
                        me.onFileSendSuccess(index, fileData, result);
                    }
                })//
                .error(function(jqXHR, textStatus, errorThrown){
                    me.onFileSendError(index, fileData, jqXHR.responseText);
                });
            });
        },
        
        onFileSendSuccess: function(index, fileData, result) {
            fileData.view.showSuccess();
            this.checkSending(index, fileData, true);
        },
        
        onFileSendError: function(index, fileData, result) {
            this.hasErrors = true;
            
            var s = CommentUtils.getServerErrorMessage(result);
            var message = s ? s : CommentUtils.Messages.errorUploadFile;
            
            fileData.view.showError(message);
            
            this.checkSending(index, fileData, false);
        },
        
        checkSending: function(index, fileData, success) {
            var me = this;
            
            me.sendCount++;
            
            if (success) {
                me.filesDataSuccess.push(fileData);
            } else {
                me.hasErrors = true;
            }
            
            if (me.sendCount === me.filesData.length) {
                me.sending = false;
                
                $.each(me.filesDataSuccess, function(index, fileData) {
                    me.removeFile(fileData.id);
                });
                
                _.delay(function(){
                    messageWidget.hide();
                    me.completeCallback.call(me, me.comment, me.hasErrors, me.filesDataSuccess.length);
                }, CommentWidgetSettings.effects.delay);
            } else {
                me.sendFile(me.sendCount);
            }
        },
        
        clear: function() {
            var me = this;
            $.each(me.filesData, function(index, fileData) {
                me.clearFileData(fileData);
            });
            me.filesData = [];
            me.attachments.empty();
        }
    });

    //
    var NewAttachmentView = Backbone.View.extend({
        
        tagName: 'div',
        className: 'new-attachment-view row',
        template: _.template(_templates.filter('#new-attachment-view-template').html()),
        
        events: {
            'click .detach': 'remove'
        },
        
        render: function() {
            this.$el.html(this.template({
                fileName: this.options.file.name
            }));
            
            this.nameInput = this.$el.find('input:text');
            
            this.errorIcon = this.$el.find('.error.icon');
                
            this.successIcon = this.$el.find('.success.icon');
            
            this.actions = this.$el.find('.actions');

            // for IE            
            var me = this;
            _.defer(function(){
                me.errorIcon.hide().removeClass('not-visible');
                me.successIcon.hide().removeClass('not-visible');
            });
            
            return this;
        },
        
        getFileName: function() {
            return this.nameInput.val();
        },
        
        showError: function(message) {
            this.successIcon.hide();
            this.errorIcon.attr('title', message).show();
            this.enabled();
        },
        
        showSuccess: function() {
            this.errorIcon.hide();
            this.successIcon.show();
            this.disabled();
        },
        
        disabled: function() {
            this.nameInput.attr('disabled', 'disabled');
            this.actions.hide();
        },
        
        enabled: function() {
            this.nameInput.removeAttr('disabled');
            this.actions.show();
        },
        
        remove: function() {
            var me = this;
            var $el = me.$el;
            $el.fadeOut(CommentWidgetSettings.effects.duration, function(){
                $el.remove();
                me.trigger('onRemove', me);
            });
        }
    });
    
    var widget = new WidgetView();
    //
    
    // API
    return {
        clear: function(){
            widget.clear();
        },
        createComment: function(postId){
            widget.createComment(postId);
        },
        editComment: function(comment){
            widget.editComment(comment);
        },
        getWidgetEl: function(){
            return widget.getViewEl();
        }
    };
};
