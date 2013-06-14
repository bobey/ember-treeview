(function() {

    // Ember Tree
    Ember.Tree = Ember.Namespace.create();

    // Ember Tree Node
    Ember.Tree.Node = Ember.ObjectProxy.extend({
        label: null,
        isActive: false,
        isSelected: false,
        isOpened: false,
        parent: null,
        children: [],

        level: function() {
            return this._computeLevel(this.get('parent'), 0);
        }.property().volatile(),

        isRoot: function() {
            return this.get('parent') === null;
        }.property('parent'),

        isBranch: function() {
            return this.get('children').length > 0;
        }.property('children', 'children.@each'),

        isLeaf: function() {
            return !this.get('children').length;
        }.property('children', 'children.@each'),

        _computeLevel: function(node, level) {
            if (null !== node) {
                return this._computeLevel(node.get('parent'), level+1);
            }

            return level;
        }
    });

    // Mixins
    /**
     * Ember.StyleBindingsMixin
     * CREDITS for this one to Addepar EmberTable
     */
    Ember.StyleBindingsMixin = Ember.Mixin.create({
        concatenatedProperties: ['styleBindings'],
        attributeBindings: ['style'],
        unitType: 'px',
        createStyleString: function(styleName, property) {
            var value;
            value = this.get(property);
            if (value === void 0) {
                return;
            }
            if (Ember.typeOf(value) === 'number') {
                value = value + this.get('unitType');
            }
            return "" + styleName + ":" + value + ";";
        },
        applyStyleBindings: function() {
            var lookup, properties, styleBindings, styleComputed, styles,
                _this = this;
            styleBindings = this.styleBindings;
            if (!styleBindings) {
                return;
            }
            lookup = {};
            styleBindings.forEach(function(binding) {
                var property, style, _ref;
                _ref = binding.split(':'), property = _ref[0], style = _ref[1];
                return lookup[style || property] = property;
            });
            styles = Ember.keys(lookup);
            properties = styles.map(function(style) {
                return lookup[style];
            });
            styleComputed = Ember.computed(function() {
                var styleString, styleTokens;
                styleTokens = styles.map(function(style) {
                    return _this.createStyleString(style, lookup[style]);
                });
                styleString = styleTokens.join('');
                if (styleString.length !== 0) {
                    return styleString;
                }
            });
            styleComputed.property.apply(styleComputed, properties);
            return Ember.defineProperty(this, 'style', styleComputed);
        },
        init: function() {
            this.applyStyleBindings();
            return this._super();
        }
    });

    // Utils
    function _moveNode(controller, overingNode, oldPosition, oldParent, newPosition, newParent) {

        if (controller.isDropAllowed(overingNode, newParent)) {

            // Node doesn't belongs to its old parent anymore
            if (overingNode.get('parent')) {
                overingNode.get('parent.children').removeObject(overingNode);
            }

            newParent.set('isOpened', true);
            overingNode.set('parent', newParent);
            newParent.get('children').insertAt(newPosition, overingNode);

            if (controller.nodeMoved) {
                controller.nodeMoved(overingNode, oldPosition, oldParent, newPosition, newParent);
            }
        }
    };

    function _getNodeFromDOM($element) {
        return Ember.View.views[$element.attr('id')].get('node');
    };

    // Controllers
    Ember.Tree.TreeController = Ember.Controller.extend({

        // Configuration
        dragAndDrop: true,
        treeNodeContainerViewClass: 'Ember.Tree.TreeNodeContainer',
        treeNodeViewClass: 'Ember.Tree.TreeNode',
        treeNodeAfterViewClass: 'Ember.Tree.TreeNodeAfter',
        displayRootElement: false,

        content: function() {}.property(),

        treeContent: [],

        treeContentDidChanged: function() {
            this.get('content').forEach(function(node) {
                this._observeNode(node);
            }, this);
            //this.notifyPropertyChange('treeContent');
            this.set('treeContent', this.get('content'));

        }.observes('content', 'content.@each'),

        _notifyTreeContentDidChanged: function() {
            this.notifyPropertyChange('treeContent');
        },

        _observeNode: function(node) {
            node.addObserver('children', this, '_notifyTreeContentDidChanged');
            node.addObserver('children.@each', this, '_notifyTreeContentDidChanged');
            node.addObserver('parent', this, '_notifyTreeContentDidChanged');
            node.addObserver('isOpened', this, '_notifyTreeContentDidChanged');
        },

        _isDescendantOf: function(descendant, parent) {
            if (!descendant || !parent || this.get('displayRootElement') && null === descendant.get('parent') || !this.get('displayRootElement') && descendant.get('parent.isRoot')) {
                return false;
            }

            return descendant.get('parent') === parent ? true : this._isDescendantOf(descendant.get('parent'), parent);
        },

        isDropAllowed: function(overingNode, targetNode) {
            if (!(overingNode instanceof Ember.Tree.Node)) {
                return false;
            }

            if (targetNode === overingNode) {
                return false;
            }

            return !this._isDescendantOf(targetNode, overingNode);
        },

        /**
         * @method nodeMoved
         * @param {Ember.Tree.TreeNode} node
         * @param {Number} oldPosition
         * @param {Ember.Tree.TreeNode} oldParent
         * @param {Number} newPosition
         * @param {Ember.Tree.TreeNode} newParent
         */
        nodeMoved: Ember.K
    });

    // Views
    Ember.Tree.TreeContainer = Ember.CollectionView.extend({

        controller: null,
        nodes: Ember.computed.alias('controller.treeContent'),
        itemViewClass: Ember.computed.alias('controller.treeNodeContainerViewClass'),
        displayRootElement: Ember.computed.alias('controller.displayRootElement'),
        classNames: ['tree-container'],

        content: function() {
            var tree = [];

            var root = this.get('nodes').findProperty('isRoot', true);

            if (!root) {
                return tree;
            }

            if (this.get('displayRootElement')) {
                tree.pushObject(root);
            }

            this._flattenTree(tree, root);

            return tree;
        }.property('nodes'),

        _flattenTree: function(tree, node) {

            if (!this.get('displayRootElement') && node.get('isRoot') || node.get('isBranch') && node.get('isOpened')) {

                node.get('children').forEach(function(childNode) {
                    tree.pushObject(childNode);
                    this._flattenTree(tree, childNode);
                }, this);
            }
        }
    });

    Ember.Tree.TreeNodeContainer = Ember.View.extend(Ember.StyleBindingsMixin, {
        defaultTemplate: Ember.Handlebars.compile('{{view view.treeNodeView}} {{view view.treeNodeAfterView}}'),
        classNames: ['tree-node-container'],
        displayRootElement: Ember.computed.alias('controller.displayRootElement'),

        treeNodeView: function() {
            return Ember.get(this.get('controller.treeNodeViewClass'));
        }.property('controller.treeNodeViewClass'),

        treeNodeAfterView: function() {
            return Ember.get(this.get('controller.treeNodeAfterViewClass'));
        }.property('controller.treeNodeAfterViewClass'),

        styleBindings:  ['indentation:padding-left'],

        indentation: function() {
            return (this.get('node.level') - (this.get('displayRootElement') ? 0 : 1) ) * 20 + 'px';
        }.property('node.level'),

        nodes: Ember.computed.alias('controller.content'),
        node: Ember.computed.alias('content'),

        // Events
        mouseEnter: function() {
            this.get('node').set('isActive', true);
        },

        mouseLeave: function() {
            this.get('node').set('isActive', false);
        },

        doubleClick: function() {
            //TODO: prevent click if double click is detected
            this.get('node').toggleProperty('isOpened');
        },

        click: function(event) {
            var node = this.get('node'),
                nodes = this.get('nodes'),
                controller = this.get('controller');

            if (!event.ctrlKey) {
                var currentNode = node;
                nodes.forEach(function(node) {
                    if (node !== currentNode) {
                        node.set('isSelected', false);
                    }
                });
            }

            node.toggleProperty('isSelected');

            if (controller.nodeClicked) {
                controller.nodeClicked(node);
            }
        }
    });

    Ember.Tree.TreeNode = Ember.View.extend({
        defaultTemplate: Ember.Handlebars.compile('{{view view.treeNodeHeader}} <span class="node-content">{{view.nodeContent}}</span>'),
        classNames: ['tree-node'],
        classNameBindings: ['node.isActive', 'node.isSelected', 'node.isBranch', 'node.isOpened:is-opened:is-closed'],

        node: Ember.computed.alias('parentView.node'),

        nodeContent: function() {
            return this.get('node.label');
        }.property('node'),

        didInsertElement: function() {
            this._super(arguments);
            this.$().draggable({
                appendTo: 'body',
                helper: function() {
                    return Ember.$('<span/>').append(Ember.$('.node-content', this).html());
                }
            });

            this.$().droppable({
                tolerance: 'pointer',
                drop: Ember.$.proxy(this.onNodeDropped, this),
                over: Ember.$.proxy(this.onNodeOver, this),
                out: Ember.$.proxy(this.onNodeOut, this)
            });
        },

        onNodeDropped: function(event, ui) {
            this.$().removeClass('drag-over drag-forbidden');

            var overingNode = _getNodeFromDOM(ui.draggable),
                controller = this.get('controller'),
                oldPosition = overingNode.get('parent.children').indexOf(overingNode),
                oldParent = overingNode.get('parent'),
                newPosition = this.get('node.children').length,
                newParent = this.get('node');

            Ember.run.scheduleOnce('afterRender', this, function() {
                _moveNode(controller, overingNode, oldPosition, oldParent, newPosition, newParent);
            });
        },

        onNodeOver: function(event, ui) {
            this.$().addClass('drag-over');
            var targetNode = this.get('node'),
                overingNode = _getNodeFromDOM(ui.draggable),
                controller = this.get('controller');

            if (!controller.isDropAllowed(overingNode, targetNode)) {
                this.$().addClass('drag-forbidden');
            }
        },

        onNodeOut: function() {
            this.$().removeClass('drag-over drag-forbidden');
        },

        treeNodeHeader: Ember.View.extend({
            node: Ember.computed.alias('parentView.node'),
            classNames: ['tree-node-header'],
            click: function(event) {
                event.stopPropagation();
                this.get('node').toggleProperty('isOpened');
            }
        })
    });

    /**
     * Target area displayed after each node
     */
    Ember.Tree.TreeNodeAfter = Ember.View.extend({
        classNames: ['drop-after-node'],
        node: Ember.computed.alias('parentView.node'),
        didInsertElement: function() {
            this._super(arguments);
            this.$().droppable({
                tolerance: 'pointer',
                drop: Ember.$.proxy(this.onNodeDropped, this),
                over: Ember.$.proxy(this.onNodeOver, this),
                out: Ember.$.proxy(this.onNodeOut, this)
            });
        },

        onNodeDropped: function(event, ui) {
            event.stopPropagation();
            this.$().removeClass('drag-over drag-forbidden');

            var controller = this.get('controller'),
                overingNode = _getNodeFromDOM(ui.draggable),
                targetNode = this.get('node'),

                oldPosition = overingNode.get('parent.children').indexOf(overingNode),
                oldParent = overingNode.get('parent'),
                newPosition = targetNode.get('parent.children').indexOf(targetNode),
                newParent = targetNode.get('parent');

            if (oldParent !== newParent || oldPosition > newPosition) {
                newPosition++;
            }

            Ember.run.scheduleOnce('afterRender', this, function() {
                _moveNode(controller, overingNode, oldPosition, oldParent, newPosition, newParent);
            });
        },

        onNodeOver: function(event, ui) {
            this.$().addClass('drag-over');

            var controller = this.get('controller'),
                overingNode = _getNodeFromDOM(ui.draggable),
                targetNode = this.get('node');

            if (!controller.isDropAllowed(overingNode, targetNode.get('parent'))) {
                this.$().addClass('drag-forbidden');
            }
        },

        onNodeOut: function() {
            this.$().removeClass('drag-over drag-forbidden');
        }
    });

})();
