
/**
 * populate following dicts:
 * var check_list //the super long one
 * var concept_to_title = {}; //3D: "3D No such concept. Replace by: (d / dimension :quant...
 * var concept_to_url = {}; //albeit: "https://www.isi.edu/~ulf/amr/lib/popup/concession.html"
 * var is_have_rel_role_91_role = {}; //ancestor: 1; aunt: 1; baby: 1
 * var is_standard_named_entity = {}; //"": 1; aircraft: 1; aircraft-type: 1
 */
function processCheckLists() {
    var core_role, explanation, role, line, matches, len, counter, counter2, n_roles, n_non_roles;
    var roleList = list_of_known_role_s.split(/   /); //"     // BEGIN ROLES       :ARG0       :ARG1       :ARG2       :ARG3       :ARG4       :ARG5       :ARG6       :ARG7       :ARG8       :ARG9       :accompanier       :age       :beneficiary       :calendar in dates       :card1       :card2       :card3
    len = roleList.length; //306
    n_roles = 0;
    counter2 = 0;
    for (var i = 0; i < len; i++) {
        line = strip(roleList[i]);
        if (matches = line.match(/^:\S+\s+\S/)) {
            matches = line.match(/^:\S+/);
            core_role = matches[0];
            explanation = line.replace(/^:\S+\s+/, "");
            counter2++;
        } else if (matches = line.match(/^(:\S+)/)) {
            core_role = matches[0];
            explanation = 'valid role';
        } else {
            core_role = '';
        }
        if (core_role) {
            n_roles++;
            check_list['role.' + core_role] = explanation;
            check_list['true-case.role.' + core_role.toLowerCase()] = core_role;
            role = core_role + '-of';
            check_list['role.' + role] = explanation + ' (inverse of ' + core_role + ')';
            check_list['true-case.role.' + role.toLowerCase()] = role;
        }
    }
    console.log('number of roles loaded: ' + n_roles + ' (incl. ' + counter2 + ' with explanations)');

    var nonRoleList = list_of_non_role_s.split(/   /); //"     // BEGIN NON-ROLES       :agent Use OntoNotes :ARGn roles       :be-located-at-91 be-located-at-91 is a verb frame, not a role.       :cause Use cause-01 (:cause is only a shortcut)       :compared-to Use have-degree-91 (reification of :degree)       :employed-by Use have-org-role-91       :experiencer Use OntoNotes :ARGn roles       :instance An instance is a special role, expressed as the slash ("/") between variable and concept.       :num Use quant       :patient Use OntoNotes :ARGn roles       :prep-except Use except-01       :prep-save Use except-01       :subset Use include-91       :theme Use OntoNotes :ARGn roles     // END NON-ROLES     "
    len = nonRoleList.length;
    n_non_roles = 0;
    for (var i = 0; i < len; i++) {
        line = strip(nonRoleList[i]);
        if (matches = line.match(/^:\S+\s+\S/)) {
            matches = line.match(/^:\S+/);
            core_role = matches[0];
            explanation = line.replace(/^:\S+\s+/, "");
            n_non_roles++;
            check_list['non-role.' + core_role.toLowerCase()] = explanation;
            role = core_role + '-of';
            check_list['non-role.' + role.toLowerCase()] = explanation;
        }
    }
    console.log('number of non-roles loaded: ' + n_non_roles);
    console.log('For role checking, loaded ' + n_roles + ' roles and ' + n_non_roles + ' non-roles.');

    var onFrameList, len, pos_char;
    counter = 0;
    for (var pos = 0; pos < 4; pos++) {
        if (pos == 0) {
            onFrameList = list_of_on_frame_unified_s.split(/   /); // // Note: * indicates more than 2 rolesets.     // BEGIN ONTONOTES UNIFIED FRAMES       abbreviation* abdication* abduction*       ablate ablation* ablaze* able* abolition* abominable* abomination* abortion*
            pos_char = '';
            len = onFrameList.length;
        } else if (pos == 1) {
            onFrameList = list_of_on_frame_verb_s.split(/   /);
            pos_char = 'v';
            len = onFrameList.length;
        } else if (pos == 2) {
            onFrameList = list_of_on_frame_adjective_s.split(/   /);
            pos_char = 'j';
            len = onFrameList.length;
        } else if (pos == 3) {
            onFrameList = list_of_on_frame_noun_s.split(/   /);
            pos_char = 'n';
            len = onFrameList.length;
        } else {
            len = 0;
        }
        for (var i = 0; i < len; i++) {
            line = strip(onFrameList[i]);
            if (line.match(/^([a-z]|FedEx)/)) {
                var tokens = line.split(/\s+/);
                var token_len = tokens.length;
                for (var j = 0; j < token_len; j++) {
                    var token = tokens[j];
                    var star = '';
                    if (token.match(/\*$/)) {
                        star = "*";
                        token = token.replace(/\*$/, "");
                    }
                    if (token.match(/^([a-z][-a-z]*|FedEx|UPS)$/)) {
                        // e.g. onvf
                        check_list['on' + pos_char + 'f.' + token] = 1;
                        if (star) {
                            check_list['on' + pos_char + 'fm.' + token] = 1;
                        }
                        // c: combination of multiple pos: v and f
                        if ((pos_char == 'j') && (check_list['onvf.' + token])) {
                            check_list['oncf.' + token] = 1;
                            if (star) {
                                check_list['oncfm.' + token] = 1;
                            }
                        }
                        counter++;
                    }
                }
            }
        }
    }

    var elemList = list_of_concept_to_title_s.split(/            /);
    len = elemList.length;
    for (var i = 0; i < len; i++) {
        var title = strip(elemList[i]);
        if (!title.match(/^\s*\/\//)) {
            var concept_l = title.match(/\S+/);
            if (concept_l && (concept_l.length == 1)) {
                var concept = concept_l[0];
                concept_to_title[concept] = title;
            }
        }
    }

    elemList = list_of_concept_to_url_s.split(/             /);
    len = elemList.length;
    for (var i = 0; i < len; i++) {
        var line = strip(elemList[i]);
        if (!line.match(/^\s*\/\//)) {
            var concept_url_l = line.match(/^\s*(\S+)\s+(\S+)/);
            if (concept_url_l && (concept_url_l.length == 3)) {
                var concept = concept_url_l[1];
                var url = concept_url_l[2];
                concept_to_url[concept] = url;
            }
        }
    }

    elemList = list_of_have_rel_role_91_roles.split(/   /);
    len = elemList.length;
    for (var i = 0; i < len; i++) {
        var line = strip(elemList[i]);
        if (!line.match(/^\s*\/\//)) {
            var roleList = line.split(/ +/);
            var len2 = roleList.length;
            for (var j = 0; j < len2; j++) {
                var role = strip(roleList[j]);
                is_have_rel_role_91_role[role] = 1;
            }
        }
    }

    elemList = list_of_standard_named_entities.split(/   /);
    len = elemList.length;
    for (var i = 0; i < len; i++) {
        var line = strip(elemList[i]);
        if (!line.match(/^\s*\/\//)) {
            var neList = line.split(/ +/);
            var len2 = neList.length;
            for (var j = 0; j < len2; j++) {
                var ne = strip(neList[j]);
                is_standard_named_entity[ne] = 1;
            }
        }
    }

    console.log('For OntoNotes frame availability check, loaded ' + counter + ' verbs.');
}

var list_of_known_role_s = " \
// BEGIN ROLES \
  :ARG0 \
  :ARG1 \
  :ARG2 \
  :ARG3 \
  :ARG4 \
  :ARG5 \
  :ARG6 \
  :ARG7 \
  :ARG8 \
  :ARG9 \
  :accompanier \
  :age \
  :beneficiary \
  :calendar in dates \
  :card1 \
  :card2 \
  :card3 \
  :card4 \
  :card5 \
  :card6 \
  :card7 \
  :card8 \
  :card9 \
  :card10 \
  :card11 \
  :card12 \
  :card13 \
  :card14 \
  :card15 \
  :card16 \
  :card17 \
  :card18 \
  :card19 \
  :card20 \
  :century in dates \
  :comparison \
  :concession \
  :condition \
  :conj-as-if \
  :consist-of \
  :day in dates \
  :dayperiod in dates \
  :decade in dates \
  :degree \
  :destination \
  :direction \
  :domain \
  :duration \
  :era in dates \
  :example \
  :extent \
  :frequency \
  :instrument \
  :li \
  :location \
  :manner \
  :medium \
  :mod \
  :mode \
  :month in dates \
  :name \
  :op1 \
  :op2 \
  :op3 \
  :op4 \
  :op5 \
  :op6 \
  :op7 \
  :op8 \
  :op9 \
  :op10 \
  :op11 \
  :op12 \
  :op13 \
  :op14 \
  :op15 \
  :op16 \
  :op17 \
  :op18 \
  :op19 \
  :op20 \
  :op21 \
  :op22 \
  :op23 \
  :op24 \
  :op25 \
  :OR special role for HyTER \
  :ord \
  :part \
  :path \
  :polarity used for negation: -\
  :polite used for imperatives: +\
  :poss \
  :prep-against \
  :prep-along-with \
  :prep-amid \
  :prep-among \
  :prep-as \
  :prep-at \
  :prep-by \
  :prep-for \
  :prep-from \
  :prep-in \
  :prep-in-addition-to \
  :prep-into \
  :prep-on \
  :prep-on-behalf-of \
  :prep-out-of \
  :prep-to \
  :prep-toward \
  :prep-under \
  :prep-with \
  :prep-without \
  :purpose \
  :quant \
  :quarter in dates \
  :range \
  :scale for certain quantities, e.g. Richter \
  :season in dates \
  :snt1 \
  :snt2 \
  :snt3 \
  :snt4 \
  :snt5 \
  :snt6 \
  :snt7 \
  :snt8 \
  :snt9 \
  :snt10 \
  :snt11 \
  :snt12 \
  :snt13 \
  :snt14 \
  :snt15 \
  :snt16 \
  :snt17 \
  :snt18 \
  :snt19 \
  :snt20 \
  :source \
  :subevent \
  :time \
  :timezone in dates (time) \
  :topic \
  :unit in quantities \
  :value \
  :weekday in dates \
  :wiki \
  :xref \
  :year in dates \
  :year2 in dates \
// END ROLES \
";

var list_of_non_role_s = " \
// BEGIN NON-ROLES \
  :agent Use OntoNotes :ARGn roles \
  :be-located-at-91 be-located-at-91 is a verb frame, not a role. \
  :cause Use cause-01 (:cause is only a shortcut) \
  :compared-to Use have-degree-91 (reification of :degree) \
  :employed-by Use have-org-role-91 \
  :experiencer Use OntoNotes :ARGn roles \
  :instance An instance is a special role, expressed as the slash (\"\/\") between variable and concept. \
  :num Use quant \
  :patient Use OntoNotes :ARGn roles \
  :prep-except Use except-01 \
  :prep-save Use except-01 \
  :subset Use include-91 \
  :theme Use OntoNotes :ARGn roles \
// END NON-ROLES \
";

var list_of_on_frame_unified_s = " \
// Note: * indicates more than 2 rolesets. \
// BEGIN ONTONOTES UNIFIED FRAMES \
  abbreviation* abdication* abduction* \
  ablate ablation* ablaze* able* abolition* abominable* abomination* abortion* aboutface* abrasion* abrogation* \
  absence* absolution* absorption* abstention* abstraction* abusive* acceleration* \
  acceptance* accommodation* accompaniment* accordance* according-to* \
  accounting* accumulation* accusation* accustomed* acetylation* achievement* aching* \
  achy* acknowledgment* acquisition* acquittal* act-out* act-up* \
  action* activating* activation* active* activeness* activity* actual* actually* actuation* \
  adaptation* adaption* add-on* add-up* addicted* addiction* addictive* \
  addition* adherent* adhesion* adjournment* adjudication* adjustment* \
  administration* admirable* admiration* admission* admitting* admonition* \
  adopted* adoption* adorable* advantage* advantageous* advanced* \
  advertise* advertisement* advertising* advertize* advertizement* advertizing* \
  advice* advisable* affair affectation* \
  affected* affiliation* affirmation* afire* afraid* aftermath* age-out* aged* \
  agglomeration* aggravating* aggregation* aging* agitated* agitation* \
  agreement* airlifting* alarming* alienation* aligned* alignment* alike* alive* alkylate alkylation* \
  allegation* alleviation* alliance* allocation* allotment* allowance* alteration* alternation* \
  amalgamation* amazed* amazing* amendment* amination* amplification* amplified* amputation* \
  amusement* amusing* analysis* anathema* angry* animation* anneal* annealing* annihilation* announcement* annoyed* annoying* \
  antagonistic* anticipation* anticoagulated* anticoagulation* apology* appalled* appalling* apparent* \
  appealing* appearance* appearing* application* appointment* appraisal* appreciated* \
  appreciation* appreciative* apprehension* apprehensive* approachable* appropriating* appropriation* approval* \
  apt* aptitude* arbitrary* arbitration* argument* arm-up* armored* arrangement* \
  arrival* articulation* as-opposed-to* ascending* ascension* ascent* ashame* ashamed* ask-out* asleep* \
  asphalt-over* asphyxiation* aspiration* assassination* assay assembly* assertion* assessment* \
  assignment* assimilation* assistance* associated* association* assumption* \
  assurance* assured* astonished* astonishing* astounding* at-once* atrophic* \
  attached* attachment* attacking* attainable* attainment* attending* attention* attentive* attenuated* attenuation* \
  attracted* attraction* attractive* attributable* auction-off* audible* augmentation* \
  authentic* authentication* authorization* automation* available* averaging* \
  avulsion* awakening* awesome* babysitting* back-off* back-up* backing* backlash \
  bad* bad-off* bail-out* balance-out* bandage-up* banding* bandy-about* bandy-around* bang-on* banging* bank-up* \
  banking* bankruptcy* banning* bargaining* bark-up-the-wrong-tree* based* \
  bashing* bat-in* bath* bathing* battering* batting* be-all* \
  be-destined* be-done* be-done-for* be-enough* be-it* be-like* be-located* be-more-like* \
  be-on-fire* be-temporally* be-with* bear-in-mind* bear-out* bear-up* bearing* \
  beat-out* beat-up* beating* beautiful* beauty* becoming* bed-down* bedding* beef-up* beginning* being* \
  belch-out* belching* belittling* belly-up* belonging* belt-out* bending* bendy* beneficial* bequest* \
  beside-the-point* best-off* betrayal* better-off* betting* biased* bickering* bidding* \
  bifurcation* biking* billing* bind-up* binding* binding-affinity biotinylate biotinylation* birthing* \
  black-out* blackened* blast-away* blast-off* blather blathering* bleed-off* bleed-out* bleeding* blessing* blinded* \
  blistering* bloated* bloating* block-up* blockage* blocking* \
  blogging* blood-on-hand* blood-on-hands* blooming* blot-out* blow-out* blow-over* blow-up* \
  blowing* blowing-out* blowing-up* blunting* blurring* blurry* \
  blurt-out* board-up* boarding* boating* bog-down* boil-down* \
  boil-over* bold* bombardment* bombing* bone-up* booing* book-up* booked* booking* boom-out* boot-up* \
  bored* boring* borrowing* boss-around* bossy* bothered* bothersome* bottle-up* bottom-out* bounce-back* bound-up* \
  bow-down* bow-out* bowl-over* bowling* box-in* boxing* \
  bracing* brainwashed* branch-out* bravery* brazen-out* breaded* \
  break-away* break-down* break-even* break-heart* break-in* break-off* \
  break-out* break-through* break-up* breakdown* breaking* breaking-off* breakup* \
  breastfeeding* breath* breathing* breeding* brick-over* bridging* briefing* bright* \
  bring-about* bring-along* bring-down* bring-on* bring-to-mind* bring-up* broad* broadening* broader* broke* \
  broke-ass* broken* brokenhearted* bruising* brush-off* brush-up* brushing* brutal* \
  brutality* buckle-down* buckle-up* budding* budgeting* buffalo build-up* \
  building* buildup-up* bulging* bulky* bullying* bump-off* bump-up* bunch-up* bundle-up* \
  buoy-up* burial* burn-out* burn-up* burning* burnout* burping* burst-out* \
  bust-out* bust-up* busting* bustling* busy butt-in* buy-into* buy-off* \
  buy-out* buy-up* buying* buying-off* buyout* buzz-off* by-election* \
  by-line* byelect* byelection* byline* calcification* calcified* calcifying* calculating* calculation* \
  call-in* call-into-question* call-off* call-on* call-out* call-up* \
  call-upon* calling* calm-down* camp-out* camping* cancellation* \
  canning* capitalization* capitulation* careful* caring* carry-off* carry-on* \
  carry-out* carry-over* cart-off* carve-out* cascading* case-in-point* cash-in* cast-light* \
  casting* castration* catch-on* catch-up* catching* \
  catching-on* catching-up* categorization* catheterization* causation* cautious* \
  cave-in* celebration* centered* centerist* centrism* centrist* \
  certification* certified* cessation* chalk-up* challenging* championing* championship* characterization* \
  charge-off* chart-out* chasing* chatter-away* chatting* cheap* cheaper* cheating* check-in* \
  check-into* check-out* check-up* checkin* checking* checkout* \
  cheer-on* cheer-up* cherry-pick* cherrypick chew-up* chewing* chicken-out* chilling* chilly* \
  chip-in* choice* choke-off* choke-up* choking* choosing* \
  chop-down* chop-up* christening* circulation* circumcision* circumscribed* citation* civilization* \
  civilized* clapping* clarification* classification* classy* clean-out* clean-up* cleaning* cleansing* \
  clear-out* clear-up* clearance* clearer* clearing* clearing-up* cleavage* clenching* \
  climbing* clingy* clip-off* clog-up* clogging* cloning* \
  close-down* close-in* close-off* close-over* close-up* closed* \
  closer* closing* clothing* clouding* cloudy* clown-around* clubbing* clumping* clunking* clutch-on* \
  co-administer* co-administration* co-culture* co-evolution* \
  co-evolve* co-existence* co-host* coactivate coactivation* coadminister* coadministration* coagulation* coating* \
  coblation* cochair* coculture* coding* coercion* coercive* \
  coexistence* coexpress coexpression* cofound* coherent* cohesion* cohost* coil-up* coimmunoprecipitate* \
  coimmunoprecipitation* cold* collaborating* collaboration* collecting* collection* \
  collision* collusion* collusive* colocalisation* colocalise* colocalization* \
  colocalize colonization* color-in* coloration* coloring* combination* \
  combustion* come-about* come-across* come-along* come-around* come-by* come-down* come-forward* \
  come-in* come-off* come-on* come-out* come-over* come-through* come-to* come-to-terms* come-to-mind* come-up* \
  come-upon* comeback comfortable* coming* coming-around* commemoration* commendable* commendation* \
  commercialization* commissioning* commitment* committed* \
  commoditization* communicating* communication* comparable* comparison* compensation* \
  competition* competitive* compilation* complaining* complaint* \
  complete* completely* completion* compliance* compliant* \
  complicated* complication* composition* comprehension* compression* compulsion* concealed* \
  concentrated* concentration* conception* concerned* concerning* concession* conclusion* \
  conclusive* concrete-over* concurrent* condensation* conditioned* conditioning* \
  conduction* conductive* confederation* conference* confession* configuration* \
  confirmation* confiscation* conflicted* conflictive* confrontation* confused* confusing* \
  confusion* congested* congestion* conglomeration* congratulation* congregation* conjugation* conjure-up* \
  connected* connecting* connection* connotation* conquering* conquest* consensual* conservation* consideration* \
  considered* consolation* consolidation* constipate constipated* constipating* constipation* constitution* construction* constructive* consultation* \
  consulting* consuming* consumption* contained* containment* contamination* contemplation* contention* continuation* \
  contract-out* contracting* contracting-out* contraction* contradiction* contraindicated* contraindication* contribution* contributive* contributory* \
  controlled* controlling* convening* convention* convergence* conversant* \
  conversation* conversion* conviction* convinced* convincing* convulsion* \
  cook-up* cooked* cooking* cool-down* cool-off* cooling* \
  coop-up* cooperation* cooperative* coopt* coordination* coping* coprecipitate coprecipitation* copy-out* \
  copying* core-out* cornification* cornify correction* correlation* correspondence* corrosion* corruption* \
  cosponsor* cotransfect* cotransfection* cough-up* coughing* could* counseling* counterfeiting* \
  counting* cover-over* cover-up* coverage* covering* \
  crack-down* crack-up* crackdown* cracking* cracking-down* cracking-up* crafty* cramping* crampy* \
  crank-out* crank-up* crap* crappy* crash-out* crazy* creation* creep-out* creep-up* creepy* crepitation* \
  crime* criminal* criminalization* crisp-up* critical* criticism* criticizing* crop-up* \
  cross-examination* cross-out* cross-pollination* cross-talk* crossexamination* crossexamine* crossing* \
  crossing-out* crosspollination* crosstalk* crowded* crushed* crushing* cry-down* \
  cry-out* crying* crying-down* crying-out* cuddling* cuddly* culpability* culpable cultivation* cupping* curable* \
  curative* curl-up* curled* curling* cut-anchor* cut-anchor-and-run* cut-and-run* \
  cut-bait* cut-bait-and-run* cut-back* cut-down* cut-it* \
  cut-loose* cut-mustard* cut-off* cut-out* cut-slack* cut-up* cutback* cutting* cycling* \
  damage* damaged* damages* damaging* \
  damning* dampened* dampening* dancing* dangerous* daring* dark* darker* \
  dash-off* date-line* dateline* dating* daunting* dazzling* \
  de-nuclearization* deacetylation* deaf* dealing* deaminate deamination* death* \
  debatable* debilitate debilitating* debilitation* \
  deceased* deceleration* deception* deceptive* decision* deck-out* \
  declaration* decomposition* decompressed* decompression* decoration* decreased* \
  decrypt* decrypted* decryption* dedicated* dedication* deduction* deep* deepest* \
  defamation* defarnesylate defarnesylation* defecation* defence* defense* defiance* \
  defined* definition* deflation* deflection* degeneration* deglycosylate deglycosylation* \
  degradation* dehydration* delayed* deleting* deletion* deliberation* \
  delineation* delivery* delocalization* delocalize delusion* demethylation* \
  demilitarization* demolition* demonstration* demoralization* demyelinating* demyelination* denaturation* denature denomination* denuclearization* denuclearize* \
  denunciation* depalmitoylate depalmitoylation* departure* dependent* dephosphorylation* depiction* depletion* deplorable* deployment* deportation* \
  deposition* depreciation* depressed* depressing* depression* deprivation* \
  depth* deregulation* derision* descended* descending* description* \
  desecration* desensitization* deserving* designation* desirable* desperate* desperation* destabilization* destruction* \
  destructive* detachment* detection* detention* deterioration* determination* determined* detestable* \
  devaluation* devastation* developed* development* deviated* deviation* devoid* devolution* \
  devotion* diagnosis* diagnostic* dialog* dialogue dictating* dictation* die-down* die-off* die-out* \
  difference* different* differentiated* differentiation* diffusely* diffusion* dig-out* \
  dig-up* digestion* digging* digress* digressing* digression* dilatation* dilated* dilation* \
  dimerization* dimerize diminished* din-out* dine-out* dining* directing* direction* disappointed* disappointing* \
  disappointment* disarmament* disarming* discernable* disclosure* discoloration* discolored* discontinuation* \
  discourse-connective* discovered* discovery* discrimination* discriminatory* discussion* disgraceful* disgruntled* disgusted* disgusting* dish-out* \
  dish-up* disheartened* disinform* disinformation* disintegration* dislocation* dismemberment* disobedience* disobediency* \
  disorganization* dispensation* dispiriting* displacement* disposal* disposition* disruption* \
  dissatisfaction* dissection* dissemination* dissention* dissociation* dissolution* distant* distended* \
  distension* distention* distinction* distorted* distortion* distracted* \
  distracting* distraction* distressed* distribution* disturbance* disturbing* ditch* divergence* \
  diversification* diversion* divide-up* divided* dividing* dividing-up* diving* division* \
  divisive* divorced* divvy-up* dizzying* do-away* do-in* docking* dockings* \
  documentation* dogsledding* doing* dole-out* doll-up* dominance* \
  dominant* dominated* domination* dominion* donation* done* done-for* doomed* \
  doped-up* dosing* doublewrap* doubling* doubtful* downing* downloading* downmodulate downmodulation* downregulation* \
  doze-off* drafting* drag-on* drained* draining* draw-down* draw-up* \
  drawing* dreadful* dream-on* dream-up* dreaming* dredge-up* dress-down* \
  dress-up* dressed* dressed-up* dressing* dribbling* drilling* drink-up* drinking* \
  drippy* drive-around* driven* driving* drooling* drooping* \
  drop-by* drop-in* drop-off* drop-out* dropping* dropping-by* \
  dropping-off* dropping-out* drown-out* drowsy* drug-up* drum-up* \
  dry-out* dry-up* drying* dubious* due* dueling* dumpy* duplication* dust-off* \
  dusting* dyed* dysregulation* ease-up* easier* easing* \
  easy* eat-away* eat-up* eating* eavesdropping* ec* ec50* ed* ed50* edge-out* edgy* \
  edification* editing* educated* educating* education* eff-up* effective* effective-concentration* effective-dose* effectiveness* \
  efficiency* effort effusion* ejaculation* ejection* elaboration* election* electoral* electrocoagulation* \
  electrocution* electrodesiccation* electronegative* elevated* elevation* elimination* elusive* elute \
  elution* emancipation* embarrassed* embarrassing* emission* emotional* emphasis* employed* \
  employment* emptying* emulation* enactment* encouragement* encouraging* encryption* \
  end-up* endangered* ending* endorsement* endowment* engaged* engagement* engineering* enhancing* \
  enlarged* enlightening* enrollment* entangled* entering* entertained* entry* enumeration* \
  equality* equation* equivocal* eradication* erection* erosion* \
  error* eruption* escalation* establishment* estimation* evacuation* evaluation* \
  evangelization* evangelize* evaporation* evasion* even-out* evening-out* evident* \
  evolution* exacerbation* exaction* exaggeration* exalted* examination* excavation* excellent* exception* excessive* \
  excision* excited* excitement* exciting* exclusion* exclusive* excommunication* excoriation* execution* exemption* \
  exertion* exfoliate exhausted* exhausting* exhaustion* exhibition* existent* existing* \
  expanded* expansion* expectation* expectative* experienced* experimentation* \
  expiration* expired* explanation* explicit* exploitation* exploiting* \
  exploration* explosion* exposure* expression* expulsion* extension* extensive* extermination* \
  extortion* extracting* extraction* extradition* extrusion* exudative* fabrication* face-off* facilitation* \
  failing* fainting* fair* fairly* fall-apart* fall-back* fall-into-hands* fall-off* fall-out* fall-over* fall-short* \
  fall-through* falling* falling-apart* falling-back* falling-off* falling-out* falling-over* \
  falling-through* familiar* famous* fantastic* farm-out* farming* farnesylate farnesylation* fart-around* \
  farting* fascinating* fascination* fashionable* fast fast-forward* faster* \
  fastforward fasting* fat* fatigued* fatten-up* faulty* \
  favorable* favour* favourable* fearful* federation* fedex* feed-up* feeding* feel-up* \
  feeling* fence-off* fencing* fend-off* fermentation* ferret-out* fess-up* feuding* fiery* fight-back* \
  fight-off* fight-on* fighting* figure-out* filing* fill-in* fill-out* \
  fill-up* filling* filling-in* filming* filtration* financing* find-out* \
  finding* fine-tuning* finetune* finetuning* finish-off* finish-out* \
  finish-up* finished* firing* firm-up* firmer* fishing* fissuring* fit-in* fitting* \
  fitting-in* fix-up* fixation* fixed* flake-out* flaking* flare-up* flash-back* \
  flashing* flat* flatten-out* flattening* flawed* fleeing* flesh-out* flexible* flexion* flickering* flip-out* \
  flipflop* flooding* flossing* fluctuant* fluctuation* fluoridate fluoridation* flush-out* flushing* \
  flustered* fluttering* fly-out* flying* foaming* focused* foggy* fold-up* \
  follow-suit* follow-through* follow-up* following* fool-around* forecasting* foreseeable* forgiving* fork-out* \
  fork-over* formation* forming* formulation* fort-up* fostering* \
  foundation* founding* fragmentation* freak-out* free-up* \
  freeze-over* freezing* fresh* freshen-up* fried* fright* frighten-away* frighten-off* \
  frightening* fritter-away* frogwalk* frustrated* frustrating* frustration* \
  fuck-around* fuck-off* fuck-up* fucked* fucked-up* fudge-over* fulfilled* fulfilling* fulfillment* \
  full* fun* functional* functioning* funding* fundraising* funnier* funny* furious* fusion* fussed* \
  fussing* fuzzy* gagworthy* gaiety* gambling* gardening* gas-up* \
  gastrulate* gastrulation* gathering* gay* gayness* gear-up* \
  general* generalization* generation* genocide geranylgeranylate geranylgeranylation* germination* gestate \
  gestation* get-along* get-around* get-away* get-back* get-by* get-down* \
  get-even* get-hand* get-hands* get-hands-on* get-off* get-on* get-out* get-through* \
  get-together* get-up* getting* \
  give-away* give-back* give-birth* give-in* give-off* give-out* give-over* \
  give-rise-to* give-up* give-vent* giving* glad* glass-over* glaze-over* \
  glistening* globalization* glorious* gloss-over* glossy* glycosylate \
  go-back* go-down* go-off* go-on* go-out* go-over* \
  go-through* gobble-up* going* golfing* gone* google \
  goosestep gossiping* governance* grabbing* gracious* grade-point-average* grading* \
  graduation* grafting* granulation* graying* greeting* grey* greying* grievance* grind-up* \
  grinding* groaning* grooming* grooving* groundbreaking grounded* grouping* grow-up* growing* \
  growing-up* grown* guarding* guidance* gulp-down* gum-up* \
  gun-down* gutting* hack-away* hacking* hacking-away* had-better* hail-down* half-life* hallucination* \
  ham-up* hammed* hammer-away* hammer-out* hammered* hammering* \
  hand-delivery* hand-out* hand-over* handcount* handdeliver* handdelivery* handling* handover* \
  handpaint* hang-on* hang-out* hang-up* hanging* hanging-on* \
  hanging-up* hankering* happening* happiness* happy harassment* hard* \
  hard-put* hardening* harder* harmful* harming* harsh* \
  hash-out* hassle hassly* hateful* haul-in* haul-out* \
  have-a-point* have-accompanier* have-age* have-an-eye* have-an-eye-on* have-beneficiary* \
  have-cause* have-comparison* have-cost* have-degree* have-degree-of-resemblance* \
  have-destination* have-downtoner* have-duration* have-eye* have-eye-on* have-example* have-extent* have-fun* \
  have-got-eye* have-half-life* have-hand* have-hands* have-in-hand* have-in-mind* \
  have-intensifier* have-li* have-list-item* have-location* have-look* have-mind* have-organization-role* \
  have-organizational-role* have-percentage-lethal-dose* \
  have-percentage-maximal-effective-concentration* have-percentage-maximal-effective-dose* \
  have-percentage-maximal-inhibitory-concentration* have-point-of-view* \
  have-policy* have-polite* have-politeness* have-property* have-relation-role* \
  have-relational-role* have-relevance* have-role* have-sex* have-source* \
  have-talking-point* have-time* have-to* \
  have-to-do* have-to-do-with* have-topic* have-viewpoint* hazardous* head-off* head-up* \
  healed* healing* hearing* heat-up* heated* heating* height* heightening* help-out* \
  helpful* hem-in* hemorrhagic* hemorrhaging* hesitant* hesitation* \
  heterodimerization* heterodimerize hide-out* hiding* high* higher* highfive* highlighting* hiking* \
  hiring* hissing* hit-on* hit-up* hitting* hoax hoaxing* hobnob-around* \
  hold-back* hold-off* hold-on* hold-out* hold-over* hold-up* holding* \
  holding-back* holding-off* holding-on* holding-out* holding-up* hole-up* hollow-out* home-schooling* homeschool* \
  homeschooling* homodimerization* homodimerize honest honesty* honorable* honored* hook-up* \
  hopeful* hopping* horriffic* hospitalization* hospitalized* hosting* hot* housing* hum-along* humid* humidification* \
  humiliated* humiliation* hungry* hunting* hurl-abuse* hurting* hybridization* hydrated* hydration* \
  hydrolysis* hydrolyzation* hype-up* hyperacetylate* hyperacetylation* hypermethylate hypermethylation* \
  hyperphosphorylate hyperphosphorylation* hyperproliferate hyperproliferation* \
  hypertrophic* hyperventilating* hyperventilation* hypophosphorylate* hypophosphorylation* hypothetical* \
  ic* ic25* ic50* idc* idealisation* idealise* idealised* idealization* idealize* idealized* identification* idk* \
  ignorant* illegal* illness* illumination* illustration* imagination* imaging* imitation* \
  immersion* immigration* immobilization* immortal* immortalization* immortalize* immortalized* \
  immortalizing* immune* immunization* immunoblot immunodetect immunodetection* immunofluoresce immunofluorescence* immunoprecipitate* \
  immunoprecipitation* immunoreact* immunoreaction* immunoreactive* immunoreactivity* immunostain immunostaining* \
  impaction* impaired* impediment* implantation* implementation* implication* implode implosion* \
  importance* important* imposition* impoverished* impressed* impression* impressive* improved* \
  improvement* in-a-light* in-a-X-light* in-advance* in-aftermath* in-consequence* \
  in-hand* in-hands* in-light* in-line* \
  in-ones-hands* in-practice* in-step* in-touch* in-trouble* inauguration* incarceration* incision* incitement* \
  inclination* inclined* including* inclusion* inclusive* incorporation* \
  incrimination* incubation* incumbency* incumbent* indemnity* indication* indicative* \
  indictment* individualistic* individualization* individualize* individualized* \
  indoctrination* induction* indurated* induration* industrialization* inept* ineptitude* ineptness* infected* \
  infection* inference* infestation* infested* infight* infighting* infiltration* inflamed* inflammation* \
  inflammatory* inflation* inflection* inflexion* influential* informative* \
  informed* infringement* infusion* ingestion* ingrained* inhalation* inheritance* \
  inhibition* inhibitory* inhibitory-concentration* initiation* injection* injured* injury* innovation* innovative* inoculate inoculation* \
  inquiry* inscription* insertion* insistence* inspected* inspection* \
  inspiration* inspirational* inspired* inspiring* installation* installment* \
  instead* instead-of* institution* instruction* insulated* insulation* \
  insulting* integration* intelligence* intense* intensely* intensification* intention* \
  intentional* intentioned* interaction* interactive* interception* interdict \
  interdiction* interested* interesting* intermixed* intern internal* \
  internment* internship* interposition* interpretation* interpreting* interrogation* \
  interruption* intersection* interspersed* interspersing* intervention* intimidating* intimidation* \
  into-hands* intonation* intoxication* intrigued* intriguing* introduction* intrusion* invaginate \
  invagination* invasion* invasive* invention* inversion* investigation* investment* invitation* invited* involved* \
  involvement* iron-out* irradiation* irregardless* irrigation* irritable* irritation* isn't-he* isolated* isolation* isomerization* \
  isomerize issuance* itching* itchy* jack-up* jammed* \
  jealous jealousy* jeering* jet-off* jk* jogging* \
  join-in* join-up* joining* joining-up* joke-around* jot-down* \
  judgement* judgment* jump-in* jump-start* jump-up* jumping* jumpstart* just* \
  justification* justified* jut-out* juxtaposition* kayaking* \
  keep-an-eye* keep-an-eye-out* keep-eye* keep-eye-open* keep-eye-out* keep-eyes-peeled* \
  keep-in-mind* keep-on* keep-up* keeping* keeping-on* keeping-up* \
  keg-stand* kegstand* ketchup* key-in* kick-in* kick-off* kick-out* kicking* \
  kidding* kill-off* kill-two-birds-with-one-stone* killing* kind-of* kissing* \
  kiyi* kneading* knifing* knitting* knock-back* knock-down* knock-in* \
  knock-off* knock-out* knock-over* knock-up* knockin* knockout* \
  knowledge* knowledgeable* known* labeling* laceration* lactation* lactate* laid-back* \
  lam-out* landing* landscaping* lash-back* lash-out* latch-on* late* laughable* laughing* laundering* \
  lay-off* lay-on* laying* layoff* ld* ld50* lead-off* \
  lead-up* leadership* leaking* leaping* learning* leasing* leave-behind* \
  leave-off* leave-out* leave-over* left* left-of-center* left-wing* legal* legality* \
  legalization* legalizing* legislation* legitimate* lending* length* let-down* let-know* let-on* \
  let-out* let-up* lethal-dose* level-off* levitation* liberal* liberalization* liberation* licensing* \
  lichenification* lick-up* lie-down* lie-in* lifting* ligation* light-up* \
  lighten-up* likely liking* limber-up* limitation* limited* line-drawing* line-pocket* line-up* linedraw* linedrawing* lining* \
  link-up* liquidation* listening* listing* litigation* livable* live-down* live-on* live-out* live-up* \
  lived* liven* liven-up* living* living-down* living-on* living-out* \
  living-up* load-up* loading* loan-out* local* localization* \
  lock-down* lock-in* lock-out* lock-up* locked* locked-out* \
  locking* lodged* lodging* log-on* logroll* look-after* \
  look-down* look-forward* look-into* look-out* look-over* look-up* looking* looking-into* loosen-up* \
  loosening* looser* looting* lose-out* losing* loss* louse-up* \
  lowering* lying* lynch lynching* lyse lysis* lytic* \
  maceration* mad* magnifying* maimed* maintenance* make-an-effort* \
  make-believe* make-do* make-it* make-mind-up* make-off* make-out* make-over* make-sense* \
  make-up* make-up-mind* making* malfunction malignant* malnourish* malnourished* malnourishment* malnutrition* \
  management* mandatory* manifestation* manipulation* manning* \
  manufacturing* mapping* marginal* marginalization* mark-down* mark-up* \
  marked* marketing* marking* marriage* married* marveling* mass-production* \
  massproduce* massproduction* match-up* matching* maturation* maturity* maximization* may* \
  meaning* meaningful* means* measurement* measuring* meddling* median-effective-dose* median-lethal-dose* mediation* medication* meditation* \
  meet-up* meeting* mellow-out* memorization* meowing* merger* merging* \
  mess-up* messaging* messed-up* metabolism* metastatic* methinks* methylation* \
  mic-up* microinject microinjection* might* migration* militarization* \
  militarize minimal* mining* minor misappropriation* miscalculation* misconduct* \
  misguided* misinform misinformation* misinformed* misinterpretation* misjudgment* \
  misperceive misperception* misrepresentation* miss-out* missed* missing* \
  misunderstanding* misunderstood* mix-up* mixing* moaning* mobile* \
  mobilization* mobilizing* moderation* modern* modernization* modification* moist* \
  moisturization* molten* monitoring* monkey-around* mooch* moocher* mooching* mopping* moral* \
  moralizing* more-like* more-like-x-than-y* mortified* motivated* motivation* mourning* movement* \
  moving* muck-up* muddle-up* muddled* muffled* muffling* mug* mugging* multi-tasking* multitask* \
  multitasking* murdered* muscling* must* mutation* muted* mutilated* muttering* nail-down* name-dropping* namedropping* \
  naming* narrow-down* narrowed* narrowing* nationalization* natural* nauseated* navigation* neaten-up* necrotic* necrotizing* \
  needed* needling* neg* negation* negative* negativity* negotiation* net-out* networking* neutral* \
  nice nicer* nitrosylate nitrosylation* no-matter* nod-off* nomination* normal* \
  normalization* normalized* nose-diving* nosediving* nosy* not-x-but-y* notable* \
  noted* notification* notifying* nourished* nuke null* nursing* \
  obedience* obedient* obfuscation* objection* objectionable* obligation* \
  obliteration* observation* obsessed* obsession* obsessional* obstructed* obstructing* \
  obstruction* occlude occlusion* occupation* of-mind* offended* offense* offensive* offering* \
  oil-up* oiled-up* oily* ok* omission* on on-fire* on-mind* on-ones-mind* on-point* on-to* \
  ongoing* onto* oozing* open-fire* open-up* opening* opening-up* operating* \
  operation* opinion* opposed* opposition* oppression* optimization* optimized* ordered* \
  ordering* orderly* ordinance* org-role* organization* organized* orientation* \
  oriented* origin* ossification* ossified* out-trade* outbreak* outfitting* outing* \
  output* outraged* outrageous* outsourcing* ovation over* overdosing* overeat overeating* overexpress overexpressed* \
  over-with* overexpression* overjoyed* overlapping* overly* overpayment* overpriced* overreaction* overriding* oversleep \
  overwhelmed* overwhelming* own-up* owned* ownership* oxidation* oxygenate oxygenation* p-value* \
  pacing* pack-away* pack-up* packaging* packing* packing-up* paid* pained* painful* painting* pair-up* \
  pairing* palm-off* palmitoylate palmitoylation* palpitation* pan-out* pandering* parcel-out* \
  pare-down* paring* paring-down* parking* parrot parse participation* pass-away* pass-by* pass-off* \
  pass-on* pass-out* pass-over* pass-up* passage* passed* \
  passing* passing-on* patch-up* patronage* pay-down* pay-off* pay-out* pay-up* payment* payoff* \
  payoff-off* peel-off* pen-up* pending* penetration* pepperspray* perception* perceptive* \
  perfection* perforation* performance* perished* perjure perjury* \
  perk-up* permission* permissive* persecution* persistent* personal* persuasion* persuasive* pervasive* perversion* pervert \
  phase-in* phase-out* philandering* phosphorylation* photo* phrase pick-away* pick-off* pick-on* \
  pick-out* pick-up* picking* piercing* pile-on* pile-up* pin-down* \
  pine-away* pioneering* pipe-down* pipe-up* piss-off* pissed* \
  pissed-off* pissy* pitch-in* pitching* pitiful* pitting* pivoting* placement* planning* \
  planting* plating* play-down* play-off* play-on* play-out* \
  play-to* play-up* playing* plea* pleased* pleasing* \
  plot-out* plug-in* plug-up* plugging* point-of-view* point-out* poised* poisoning* poisonous* poke-around* \
  poking* polarization* policing* policy polish-off* polish-up* politicized* \
  pollution* polyploidisation* polyploidise* polyploidization* polyploidize pontificating* \
  poohpooh* poopoo* poo-poo* pooling* pop-off* pop-to-mind* pop-up* popping* population* \
  portrayal* posing* positioning* possession* possessive* \
  possible posting* postponement* posturing* potentiate potentiation* pound-out* pounding* \
  pouring* powerful* pre-emptive* pre-exist* pre-existing* pre-negotiaton* pre-separation* \
  precedence* precipitation* precondition* preconditioning* \
  prediction* predisposition* predominant* preemptive* preexist preexisting* \
  preferable* preference* preferential* pregnant* preincubate preincubation* \
  prenegotiate* prenegotiaton* prenylate* prenylation* preoccupation* preparation* prepared* \
  prepayment* prescription* presentable* presentation* presenting* \
  preseparate* preseparation* preservation* preserved* preset* press-gang* pressed* pressgang pressing* \
  presumption* presumptive* presumptuous* pretreat pretreatment* prevention* \
  price-out* prick-up* print-out* printing* private* privatization* proceeding* processing* \
  procession* procurement* producing* production* productive* profession* \
  profitable* profiteering* programme* programming* progression* progressive* prohibition* prohibitive* \
  projection* proliferation* prolongation* promising* promotion* pronate* pronation* pronounced* \
  prop-up* propagation* proposal* proposition* propulsion* prosecution* prospering* \
  prosperous* prostitution* protection* protective* proteolysis* proteolytic* \
  proteolytical* proteolyzation* proteolyze* protesting* protrusion* \
  proven* provocation* provocative* provoking* public* publication* publicized* \
  publishing* pucker-up* puckering* puff-up* puke-up* pull-down* \
  pull-off* pull-out* pull-over* pull-through* pull-up* pulling* \
  pulling-off* pulling-out* pulling-over* pulling-through* pulsation* pump-out* pump-up* \
  pumping* pumping-up* punching* punishable* punishment* pure* pursuit* push-up* \
  put-down* put-in* put-off* put-on* put-out* put-up* \
  puzzled* puzzling* qualification* qualified* quantification* quantitate quantitation* quarreling* \
  questionable* questioning* queue-up* quick* quicker* quiet-down* quieten-down* quotation* \
  racing* rack-up* racketeer* racketeering* radiation* raising* \
  rake-in* rambling* ramification* ramp-up* rampage ranking* \
  rant ranting* rare* ratchet-up* rate-entity* rather-than* rating* \
  ration-out* rational* rationalization* rationalize* rationing* rattle-off* \
  rattle-on* re-election* re-emergence* re-emphasis* re-employment* re-enactment* \
  re-evaluation* re-unification* reaching* reaction* reactionary* reactivation* reactive* \
  read-off* read-up* readiness* reading* reading-up* readmission* real* \
  realistic* realization* really* reapplication* reapproximation* rear-end* reasonable* reasoning* reassessment* reassuring* rebellion* \
  rebuttal* recase* receding* received* reception* recession* reciprocate \
  reciprocation* reciprocity* recirculation* recital* reckoning* recognition* recollection* \
  recommendation* reconciliation* reconstituted* reconstitution* reconstruction* recording* recovery* \
  recreation* recruiting* recruitment* recurrence* recyclable* recycling* red* reddish* \
  redebate* redemption* redistribution* reduced* reduction* reel-off* reelection* reemerge* reemergence* \
  reemphasis* reemphasize* reemploy* reemployment* reenactment* reengage* reenter* \
  reevaluation* reexamination* reexport* referral* referring* refight* refilling* refinement* refining* refix* \
  reflection* refocusing* reformation* refueling* regardless* regeneration* \
  registration* regression* regretful* regrow regrowth* regular* \
  regulated* regulation* regurgitation* rehabilitation* rehydration* reimplantation* \
  rein-in* reinforcement* reinjection* reinsurance* rejection* rejuvenation* rel-role* \
  relandscape* related* relation* relationship* relative* relatively* relaxation* \
  relaxing* releasing* relevance* reliant* relief* relieved* relieving* \
  relocation* reluctance* remain-to-be-seen* remaining* remarkable* remarriage* remarried* \
  remaster remastering* remediation* remembering* remembrance* remission* \
  remortgage removal* remuneration* rendering* rendition* renewal* renomination* renovation* \
  renown* renowned* rent-out* rental* renting* renting-out* reopening* reoperation* \
  reorganization* reorientation* repatriation* repayment* repetition* replaced* replacement* replication* replied* reporting* repositioning* \
  representation* representative* repression* reproducible* reproduction* reprogram* reprogramming* \
  request-confirmation* request-response* requirement* \
  resentful* reservation* reserved* reship* residence* resignation* \
  resistance* resistant* resolution* resolved* resonance* resonant* \
  resorb resorption* respectful* respiration* respiratory* responding* \
  response* responsibility* responsibleness* responsive* resting* restitution* restoration* restrained* \
  restraint* restriction* restructuring* resultant* resummon* resumption* resurrection* \
  resuscitation* retaliation* retardation* retarded* retention* retentive* retesting* rethinking* retired* \
  retirement* retracting* retraction* retraining* retrieval* reunification* reunify* reunion* rev-up* revelation* \
  reversal* reversion* revictimize* revision* revitalization* revival* revocation* revolution* revolutionary* rewarding* \
  ride-out* ride-up* ridiculous* rig-up* right-of-center* right-wing* rightsize* ring-up* ringing* \
  rioting* rip-off* rip-out* rip-up* ripe* ripening* rise-up* risky* roasting* \
  rock-on* role-reification* roll-back* roll-out* roll-up* rollback* \
  romanization* romanize* romantic* root-out* rooted* rotation* rough-in* rough-up* roughed-up* round-out* \
  round-up* rounded* rout* routing* rowing* rubber-stamp* rubberstamp* rubbery* rubbing* rule-out* ruling* \
  run-down* run-in* run-off* run-out* run-over* run-up* runaround* \
  running* running-off* running-out* running-up* rushed* sacking* sad* \
  safer* safest* sailing* sale* salivation* salt-away* \
  salutation* sampled* sampling* sanitation* satiation* satisfaction* satisfactory* satisfied* saturation* \
  save-up* saving* saving-up* saw-up* scaling* scalloping* scam scanning* \
  scape* scared* scaring* scarring* scary* scattering* \
  scheduling* schmoozing* schooling* sclerosing* sclerotic* scolding* scoop-up* \
  score-entity* score-on-scale* scoring* scout-out* scrapping* scratch-out* scratching* \
  scrawl-out* screen-out* screening* screw-over* screw-up* screwed* \
  screwed-up* screwup* scrub-up* scrunch-up* scrupulous* seal-off* searching* seasoned* seasoning* secondguess* \
  secretion* sectioning* sedated* sedation* seeding* seek-out* seeking* segregation* seize-up* seizure* selection* \
  self-destruction* selfadjust* selfadjustment* selfdestruct* selfdestruction* selfefface* selfestablish* \
  sell-off* sell-out* selling* send-out* sensation* sensible* \
  sensing* sensitization* sentencing* separated* separation* sequence sequencing* sequestering* serrate serration* \
  serve-up* serving* serving-up* set-ablaze* set-about* set-afire* set-down* set-fire* set-off* set-on-fire* set-out* \
  set-up* set-upon* setting* setting-up* settle-down* settlement* \
  sew-up* sex* sexy* shack-up* shading* shadowing* shake-off* shake-up* \
  shaking* shameful* shaming* shape-up* shaped* share-out* sharing* sharp* shaving* \
  shell-out* shine-through* ship-out* shipping* shocked* shocking* \
  shoot-back* shoot-down* shoot-off* shoot-up* shooting* shootout* shopping* shore-up* \
  shorten* shortening* shorter* shot* should* shout-down* \
  shout-out* show-off* show-up* showing* showing-off* shrug-off* shuffle-off* shunting* \
  shut-down* shut-off* shut-out* shut-up* shutdown* shuttle-off* shy-away* sick* sickening* \
  sideline* siege* sightseeing* sign-in* sign-off* sign-on* sign-up* significant* signing* \
  signing-in* signing-off* signing-on* signing-up* silt-up* simple* simulation* singing* single-out* sinkex* siphon-off* \
  sit-down* sit-in* sit-out* sit-up* sitting* size-up* skateboarding* \
  sketch-out* skiing* skim-off* skimming* skip-off* slack-off* slaying* sleep-away* \
  sleep-off* sleep-over* sleep-walk* sleeping* sleepy* slice-up* slim-down* slip-in* \
  slow-down* slower* slowing* slug-out* sluice-down* smarten-up* smarter* smash-up* smashing* smashing-up* smoking* \
  smooth-out* smooth-over* smuggling* snacking* snap-off* snap-up* \
  snatch-away* sneaky* sneezing* sniff-out* snoring* snowy* snuff-out* soak-up* sobbing* \
  sober-up* social* socialization* socializing* sock-away* soft* softening* \
  soiling* solicitation* solid* solution* solving* sorrowful* \
  sort-out* sound-off* sounding* sparing* speak-out* speak-up* speaking* special* specific* specification* \
  speculating* speculation* speech* speed-up* speeding* speedy* spell-out* spelling* \
  spend-down* spending* spent* spike-out* spill-out* spill-over* spin-off* \
  spinning* spinning-off* spinoff* spite* spitting* splash-out* splaying* splinting* \
  split-up* splitting* spotting* spout-off* spread-out* spreadeagle* spreading* spring-up* \
  spruce-up* spying* square-off* squeeze-out* squeezing* squinting* \
  stabbing* stabilization* stack-up* stagflation* staging* stagnation* staining* stake-out* stalking* stall-off* stall-out* \
  stamp-out* stance* stanced* stand-by* stand-down* stand-out* \
  stand-up* standard* stare-down* staring* start-in* start-off* start-out* \
  start-over* start-up* starting* startling* starvation* starving* \
  stash-away* statement* statistical-test stave-off* stay-on* stay-over* steal-away* \
  steeped* steer-clear* steering* stenotic* stenting* step-aside* \
  step-down* step-in* step-up* stereotype* stereotypic* sterile* \
  sterilization* stick-around* stick-out* stick-up* stiff* stiff-arm* stiffening* stiffing* stifling* stigmatizing* \
  stimulation* stinging* stipulation* stir-up* stock-up* stocking* stoked* \
  stop-by* stop-off* stop-over* stop-up* stopover* stoppage* stopped* \
  storage* store-up* straight* straight-out* straighten-out* straighten-up* straining* \
  stranded* stranding* strappped* strategizing* stratification* streaming* \
  street-address* strength* strengthening* stress-out* stressed* stressed-out* stressful* stressing* \
  stretch-out* stretching* strike-down* strike-out* strike-up* strip-away* \
  stripping* striving* strong* stronger* strongly* struggling* study-up* \
  studying* stunned* stunning* stupefied* subclone subdivision* subjective* \
  submission* submissive* subscription* subset* subsidence* subsidy* substitution* success* successful* \
  succession* suck-up* suffering* sufficient* suffocation* suggestion* \
  suggestive* suit-up* suited* sum-up* summon-forth* superset* supinate* supination* \
  supervision* supplementation* supportive* \
  supposed* suppression* sure* surgery* surgical* surprised* surprising* surrounding* survival* \
  suspension* suspicion* swallow-up* swallowing* swamped* swear-in* swear-into* \
  swear-off* swearing* swearing-in* sweat-off* sweat-out* sweating* \
  sweaty* sweep-up* sweeping* sweet* sweetness* swelling* swimming* switch-over* switching* swollen* \
  swoop-up* sympathetic* synchronization* synchronous* syndication* synergise* synergistic* synergize synergy* table tabled* \
  tabling* tabulation* tack-down* tack-on* tag-along* tag-question* \
  take-aback* take-advantage* take-away* take-down* take-hold* take-in* \
  take-into-account* take-issue* take-look* take-off* take-on* take-out* take-over* \
  take-precaution* take-up* take-with-grain-of-salt* \
  takeover* taking* taking-aback* taking-away* taking-down* taking-hold* taking-in* taking-off* taking-on* \
  taking-out* taking-over* taking-up* talk-out* talking* tally-up* tamp-down* tampering* \
  tangle-up* tanned* tanning* tape-up* taper-off* tapering* tapering-off* targeted* tariff* tasting* tattooing* \
  tax-away* taxation* teaching* team-up* tear-down* tear-up* tearing* tearing-down* \
  tearing-up* teary* tease-out* teasing* tee-off* teething* \
  tell-on* telling* temptation* tempted* tempting* tension* \
  termination* terribly* terrified* terrifying* terror* terrorisation* \
  terrorise* terrorism* terrorization* test-score* testimony* testing* \
  tetramerisation* tetramerise* tetramerization* tetramerize text texting* thankful* \
  thanks* thaw-out* the-more-the-less* the-more-the-more* the-x-er-the-y-er* \
  thick* thickened* thickening* thin-out* think-over* \
  think-through* think-up* thinking* thinner* thinning* thinning-out* thirsty* \
  thought* thrash-out* threat* threatening* thrilled* thrilling* throw-away* throw-in* \
  throw-out* throw-under-bus* throw-up* throwing* tick-off* tickling* tidy-up* \
  tie-down* tie-in* tie-up* tight* tighten-up* tightening* tighter* \
  tiling* timely* timing* tinged* tingling* tip-off* \
  tip-over* tiptoeing* tire-out* tired* titration* to-boot* to-the-point* toilsome* tolerance* \
  tolerant* tolerated* tone-down* top-off* top-up* torn* \
  toss-in* toss-out* tossing* tot-up* total-up* tote-up* totter-around* touch-base* \
  touch-off* touch-on* touch-up* touch-upon* touching* touching-base* touching-off* \
  touching-on* touching-up* touching-upon* touchy* tough* tougher* towing* tracing* track-down* tracking* \
  tracking-down* trade-off* tradeoff* trading* trail-off* training* \
  transaction* transactivate transactivation* transcription* transduce transduct* transduction* transfect* transfection* transformation* \
  transfusion* transient* translation* transliteration* transliterate* translocate translocation* \
  transmigrate transmigration* transmission* transphosphorylate transphosphorylation* transplantation* \
  transportation* transposition* trapped* trapping* trauma* traveling* travelled* \
  travelling* treating* treatment* trending* trial* tricky* trigger-off* triggering* strip-down* \
  trot-out* troubled* truly* try-out* trypsinisation* trypsinise* trypsinize* trypsinization* tubulate \
  tubulation* tuck-away* tuck-in* tune-in* tune-out* tunneling* \
  turn-away* turn-down* turn-in* turn-off* turn-on* turn-out* \
  turn-over* turn-up* turning* tutoring* twisted* type-up* \
  typical* typing* typing-up* ubiquitination* ulcerated* ulceration* \
  under-go* underestimation* underfund* underfunding* undermining* underpinning* understanding* understatement* \
  undertaking* undoing* unfreeze unfrozen* unification* union* unique* uniqueness* \
  united* unlocked* unpacked* unsettled* unsettling* unveiling* \
  upbringing* upregulation* uprising* ups upsetting* urbanization* urination* use-up* \
  used* used-to* useful* usher-in* using* utilitarian* utilization* utter* utterly* \
  vaccinate vaccination* vacuuming* validation* valuable* \
  valuation* vamping* variable* variance* variant* variation* \
  varied* vascularisation* vascularise* vascularization* vascularize ventilated* ventilation* verification* vexation* vibration* \
  viewing* vigilance* vigilant* vile* violation* visible* visiting* visualization* vocalization* voiding* voluntary* \
  vomit-up* vomiting* vote-down* voting* vulnerability* vulnerable* wait-out* waiting* waiting-out* waiving* \
  wake-up* waking-up* walking* wall-off* ward-off* warfare* warm-over* warm-up* warmer* \
  warming* warning* warranted* wash-down* wash-up* washing* washing-down* washing-up* wasted* wasteful* wasting* \
  watch-out* watch-over* watching* water-down* watery* waxing* weakening* \
  weaker* weaning* wear-down* wear-off* wear-on* wear-out* \
  weasel-out* wedding* weeping* weigh-in* welcomed* well* well-off* \
  well-up* wellbeing* westernised* westernization* wetting* whack-off* \
  wheezing* whether-or-not* while-away* whining* whip-out* whip-up* white* whiter* whittle-down* whiz-away* whooping* \
  whooshing* wide* widening* wider* widowed* width* will-you* \
  willing* win-over* wind-down* wind-up* wine wining* \
  winning* wipe-off* wipe-out* wipe-up* withdrawal* withholding* \
  without-regard* wolf-down* womanizing* wonderful* wording* work-out* \
  work-up* working* working-out* works* worried* worrisome* worrying* \
  worse* worse-off* worsen* worsening* worst* worth worthy* would-like* would-love* wound-up* \
  wounded* wrap-up* wrestling* wring-out* wringing* write-down* \
  write-in* write-off* write-out* write-up* writing* xray* \
  yammer-away* yammer-on* yapping* yawning* yellowing* yield-up* zero-in* zero-out* zip-up* zone-out* \
// END ONTONOTES UNIFIED FRAMES \
";

var list_of_on_frame_verb_s = " \
// Note: * indicates more than 2 rolesets. \
// BEGIN ONTONOTES VERB FRAMES \
  FedEx* UPS* abandon* abase abash abate abbreviate abdicate abduct abet \
  abhor abide abnegate abolish abominate* abort abound about-face* abrade abridge \
  abrogate absent absolve absorb abstain abstract abuse* abut accede accelerate accent \
  accentuate accept access accessorize acclaim accommodate accompany accomplish accord* account* \
  accredit accrete accrue accumulate accurse accuse accustom ace acetify acetylate ache \
  achieve acidify acknowledge acquaint acquiesce acquire acquit act* activate actualize* \
  actuate adapt add* addict* addle address* adhere adjoin adjourn adjudicate \
  adjust administer administrate admire* admit admix admonish adopt adore* adorn \
  advance* advert advise advocate affect* affiliate affirm affix afflict \
  afford* affront africanize age* agglomerate aggravate aggregate aggrieve agitate agonize \
  agree* ah aid ail aim air airlift airmail alarm alcoholize \
  alert alienate align alkalify allay allege alleviate alligator allocate allot \
  allow* allude allure ally alter alternate amalgamate amass amaze amble \
  ambush ameliorate amend americanize aminate amortize amount amplify amputate amuse analyze \
  anchor anesthetize anger angle anglicize anguish animalize animate annex annihilate \
  annotate announce annoy annul anoint answer* antagonize anticipate anticoagulate antique \
  apologize apostatize appall appeal* appear appease append applaud applique apply* \
  appoint* apportion appraise appreciate* apprehend* apprentice apprise approach* appropriate approve \
  approximate arbitrage* arbitrate* arch archive argue* arise* arm* armor aromatize \
  arouse arraign arrange array arrest arrive arrogate arson* art articulate ascend \
  ascertain ascribe ask* asphalt* asphyxiate aspirate* aspire* assail assassinate assault \
  assemble assert* assess assign assimilate assist associate assuage assume assure \
  astonish astound at-hand* at-hands* atomize atone atrophy attach attack attain attempt attend \
  attenuate attest attire attract attribute attune auction* audit audition augment \
  augur authenticate* author authorize autograph automate autopsy avail* avenge aver \
  average* avert avoid avulse await awake* awaken* award awe* baa \
  babble babysit back* backbite backfire backpack backpedal backslap backtrack badger \
  badmouth baffle bag bail* bait* bake balance* balk balkanize ball \
  balloon ballyhoo bamboozle ban band bandage* bandwagon* bandy* bang* banish bank* \
  bankroll bankrupt banquet banter baptize bar barb barbecue barbeque bare \
  bargain barge bark* barnstorm barrack barrel barricade barter base bash \
  bask baste* bat* bathe batter battle bawl bay bayonet be* \
  be-destined-for* be-from* be-located-at* be-on-hand* be-polite* be-temporally-at* \
  beach bead* bead-up* beam bear* beard beat* beatify beautify* beckon become* \
  bed* bedeck bedevil bedew beef* beep beetle befall befit befriend \
  befuddle beg beget begin begrudge beguile* behave behead behold behoove \
  belay belch* beleaguer belie believe belittle bellow belly* belly-flop* bellyflop* \
  belong belt* bemoan bench bend* benefit bequeath berate bereave berry \
  berth beseech beset besiege besmirch best* bestow bestrew bestride bet \
  betray betroth better* bewail beware bewilder bewitch bias bicker bicycle \
  bid* bide biff bifurcate bike bilk bill billet billow bin \
  bind* biopsy birch birdnest birth* bisect bitch bite bivouac blab \
  blabber black* blackberry blacken* blacklist blackmail blame blanch* blanket blare \
  blaspheme blast* blat blaze bleach bleat* bleed* blemish blend bless \
  blight blind blindfold blindside* blink blister* blitz bloat block* blockade blog \
  blood* bloody bloom blossom blot* blow* blubber bludgeon bluff blunder \
  blunt blur blurt* blush bluster board* boast boat bob bobsled \
  bode bog* boggle boil* bolshevize bolster bolt bomb bombard bond \
  bone* bonk boo boogie book* boom* boost boot* bootleg booze \
  bop border bore borrow boss* botch bother bottle* bottlefeed bottleneck \
  bottom* bounce* bound* bow* bowl* box* boycott brace bracket brag \
  braid brain brainwash braise brake branch* brand brandish brave brawl \
  bray brazen* breach bread break* break-ground* breakfast breakthrough* breast breastfeed breathe \
  breed brew bribe brick* bridge bridle brief brighten* brim bring* \
  bring-to-light* bristle broach broadcast broaden* brocade broil broker bronze brood brook \
  browbeat brown browse bruise brunch brush* brutalize* bubble buck buckle* \
  bud budge budget buff buffer buffet bug build* bulge bulk* \
  bull bulldoze bullet bullock bullshit bully bumble bump* bunch* bundle* \
  bungle bunk bunt buoy* burble burden burgeon burglarize* burglary* burgle* burl \
  burn* burnish burp burr burrow burst* bury bus bushwhack bust* \
  bustle butcher butler butt* butter button buttonhole buttress buy* buzz* \
  by-elect* bypass cab cabbage cable cackle caddy cadge cage cajole \
  cake calcify calculate calibrate calk* call* calm* calumniate calve camouflage \
  camp* campaign can* cancan cancel candy cane canoe canonize \
  canter canvass cap capacitate capitalize capitulate capsize captain caption captivate \
  capture caramelize caravan carbonify carbonize care* careen caress caricature carjack \
  carol carom carouse carp carpet carry* cart* carve* cascade case* \
  cash* cast* castigate castle castrate* catalog* catalogue catalyze catapult catch* \
  catechize categorize cater catheterize catholicize catnap caulk* cause* cause-trouble* cauterize caution* \
  cave* cavort caw cease cede celebrate cellar cement censor censure \
  center centralize certify chafe chaff chagrin chain chair chalk* challenge \
  champion* chance change* change-hand* change-hands* channel chant chaperone char characterize* charbroil charcoal \
  charge* chariot charm chart* charter chase chasten chastise chat chatter* \
  chauffeur cheapen* cheat* check* cheep cheer* cheerlead cherish chew* chicken* \
  chide chill* chime chink chip* chir chirp chirrup chisel chitchat \
  chitter chlorinate choke* chomp choose chop* choreograph chortle christen christianize \
  chrome chronicle chuck chuckle chug* chunk churn cinch* circle circularize \
  circulate circumcise circumscribe circumvent cite civilize clack* clad claim clam \
  clamber clamor clamp clang clank clap clarify* clash clasp class* \
  classify clatter claw clay clean* cleanse clear* cleave clench clerk \
  click climax climb clinch cling clink clip* cloak clobber clock \
  clog* cloister clomp clone close* clothe cloud* clout clown* cloy \
  club* cluck clump* clunk cluster clutch* clutter co-author* co-chair* co-exist* \
  co-found* co-opt* co-sponsor* coach coagulate coal coalesce coarsen coast coat \
  coauthor* coax cobble cock coddle code* codify coerce coevolution* coevolve* coexist* \
  cohabit cohere coil* coin coincide coldcream collaborate collapse collar collate \
  collect collide collude colonize color* comb combat combine combust come* \
  comfort* command commandeer commemorate commence commend* comment commercialize commingle commiserate \
  commission commit commit-arson* commodify communicate commute compact compare* compel compensate compete \
  compile complain complement complicate compliment comply compose compost compound \
  comprehend compress comprise compromise compute computerize con* concatenate conceal concede* \
  conceive concentrate concern* conciliate conclude concoct concrete* concur* condemn condense \
  condescend condition condone conducive* conduct* cone* cone-down* confabulate confederate confer confess confide \
  configure confine confirm confiscate conflict conform confound confront confuse conga \
  congeal congest congratulate congregate conjecture conjoin conjugate conjure* conk connect \
  connote conquer consecrate* consent* consequence* consequential* \
  conserve consider consign consist consistency* console consolidate \
  consort conspire constellate constitute* constitutionalize* constrain constrict constringe construct* construe \
  consult consume consummate contact contain contaminate contemplate contemporize contend content \
  contest contextualize continue contort contract* contradict contraindicate contrast contravene contribute \
  contrive control convene converge converse* convert convey convict* convince convoke \
  convolute convulse coo cook* cool* coop* cooperate coordinate cop cope \
  copy* copyright cordon core* cork corner corral correct correlate correspond \
  corroborate corrode corrugate corrupt cosh cosset cost costume couch cough* \
  counsel count* countenance counter counteract counterattack counterbalance \
  counterchallenge counterfeit countersue \
  countervail coup* couple course* court cover* covet cow cower cowrite cox \
  cozen crab crack* crackle cradle craft* cram cramp crane crank* \
  crash* crate crave crawl crayon craze* creak cream crease create \
  credential credit creep* cremate crepitate crest crew criminalize* crimp crimson \
  cringe crinkle cripple crisp* crisscross criticize* critique croak crochet crook \
  croon crop* cross* cross-examine* cross-pollinate* crosspollinate* crouch crow crowd crown* \
  crucify cruise crumb* crumble crump crumple crunch crush cry* crystallize \
  cub cube cuckold cuckoo cuddle* cudgel cuff cull culminate cultivate \
  culture cum cup* curb curdle cure* curl* curry* curse curtail \
  curtain curtsey curve cushion customize cut* cycle dab dabble dally \
  dam damn damp* dampen* dance dandle dangle dapple dare \
  darken* darn dart* dash* date daub daunt dawdle dawn daze \
  dazzle de-nuclearize* deaccent deacetylate deactivate deaden deadlock deafen* deal* debark debate* \
  debauch debone debowel debug debunk deburr debut decamp decant decapitate \
  decay decease deceive decelerate decentralize decide decimate decipher deck* declaim \
  declare declassify declaw decline decoct decode decommission decompose decompress* decontaminate \
  decorate decouple decrease decree decry dedicate deduce deduct deem deemphasize \
  deep-fry* deepen* deepfry deescalate deface defame defang defat default defeat \
  defeather defecate defect defend defer* defile define* deflate deflea deflect \
  deflesh deflower defoam defog deforest deform defraud defray defrost defuse \
  defuzz defy degas degenerate degerm deglaze degrade degrease degrit degum \
  degut dehair dehead dehorn dehull dehumidify dehusk dehydrate deice deify \
  deign deink deject delay delegate delete deliberate delight* delimit delineate \
  delint delist deliver* delouse delude deluge deluster delve demagnetize demagogue \
  demand demarcate demast demean demethylate demilitarize demobilize democratize demolish demonize demonstrate \
  demoralize demote demur demyelinate denationalize denigrate denominate denote denounce dent \
  denude deny depart depend dephosphorylate depict deplete deplore* deploy \
  depolymerisation* depolymerise* depolymerization* depolymerize* depopulate deport \
  depose* deposit* deprecate depreciate depress depressurize deprive derail derange derat \
  deregulate derib deride derind derive desalinate desalt descale descend describe \
  descry desecrate desensitize desert deserve desex desiccate design designate desire* \
  desist despair* despise despoil desprout destabilize destarch destigmatize destine destress \
  destroy destruct detach detail detain detassel detect deter deteriorate determine* \
  detest* dethrone detonate detract detusk devalue devastate devein develop deviate \
  devise devolve devote devour dewater dewax deworm diagnose diagram dial \
  diaper dice dicker dictate die* differ differentiate diffract diffuse dig* \
  digest dignify dilate dilute dim dime diminish din* dine* ding \
  dip direct dirty disable disabuse disagree disallow disappear disappoint disapprove \
  disarm disassemble disassociate disavow disband disbelieve disburse discard discern discharge \
  discipline disclaim disclose discolor discombobulate discomfit discompose disconcert disconnect discontinue \
  discount discourage discourse discover discredit discriminate discuss disdain disembark disembowel \
  disenchant disencumber disenfranchise disengage disentangle disfigure disgorge disgrace disgruntle disguise \
  disgust dish* dishearten dishonor* dishonour* disillusion disincline disinherit disintegrate disinvite \
  dislike dislocate dislodge dismantle dismay dismember dismiss dismount disobey disorganize \
  disown disparage dispatch dispel dispense disperse dispirit displace display displease \
  dispose* dispossess disprove dispute disqualify disquiet disregard disrespect disrobe disrupt \
  dissatisfy dissect dissemble disseminate dissent dissimilate dissimulate dissipate dissociate dissolve \
  dissuade distance* distemper distend distil* distill distinguish distort distract distrain \
  distress distribute distribution-range distrust disturb dither dive diverge diversify divert divest \
  divide* divorce divulge divvy* dizzy do* do-long-jump* do-longjump* dock doctor document dodder \
  dodge doff dog dogsled dole* doll* dollarize domesticate dominate don \
  donate dong doodle doom dope* dope-up* dose dot double double-cross* double-wrap* \
  doublecross* doubt* douse dovetail down* downgrade downlink download downplay downregulate downsize \
  doze* draft drag* drain drape draw* draw-line* draw-line-in-sand* drawl dread* dream* dredge* \
  drench dress* dribble drift drill drink* drip drive* drizzle drone \
  drool droop drop* drown* drowse drug* drum* dry* drydock dub \
  duck duel dull* dumbfound dump* dunk dupe duplicate dust* dwarf \
  dwell dwindle dye dyke dysregulate earmark earn ease* eat* eavesdrop ebb \
  echo eclipse economize eddy edge* edify edit editorialize educate eek \
  efface* effect* effectuate effeminate effervesce effuse ejaculate eject elaborate elapse \
  elate elbow elect* electrify electrocute* electroplate elevate elicit eliminate elongate \
  elucidate elude emaciate email emanate emancipate emasculate embalm embargo embark \
  embarrass embattle embed embellish embezzle embitter emblazon embody embolden* emboss \
  embrace embrocate embroider embroil emcee emerge emigrate emit emote* empathize \
  emphasize emplace employ empower empty emulate emulsify enable enact enamel \
  encapsulate encase enchain enchant encircle enclose encode encompass encounter encourage \
  encroach encrust encrypt encumber end* endanger endear endeavor endorse endow \
  endure energize enervate enflame enforce engage* engender engineer engrave engross \
  engulf enhance enjoin enjoy enlarge enlighten enlist enliven* enquire enrage \
  enrapture enrich enroll ensconce enshrine enslave ensnare ensnarl ensue ensure* \
  entail entangle enter* entertain enthrall enthuse* entice entitle entomb entrance* \
  entrap entreat entrench entrust entwine enumerate enunciate envelop envisage envision \
  envy epitomize epoxy equal* equalize* equate equilibrate equip equivocate eradicate \
  erase erect erode err eruct erupt escalate escape eschew escort \
  espouse espy essay establish esteem estimate estrange etch eternalize etiolate \
  eulogize europeanize evacuate evade evaluate evaporate even* eventuate evict evidence \
  evince eviscerate evoke evolve exacerbate exact exaggerate exalt examine* exasperate \
  excavate exceed* excel* except excerpt exchange excise excite exclaim exclude* excommunicate \
  excoriate excruciate excuse execrate execute exemplify exempt exercise exert exhale \
  exhaust exhibit exhilarate exhort exhume exile exist exit exonerate exorcise \
  expand expect expectorate expedite expel expend experience experiment expiate expire \
  explain explicate* explode* exploit explore export expose expound express* expunge \
  expurgate extend* exterminate extinguish extirpate extol extort extract* extradite extrapolate \
  extricate extrude exude exult eye* eyeball fabricate face* facilitate factor \
  fade fail faint fake fall* falsify falter fame familiarize famish \
  fan fanaticize fancy fantasize* fare farm* fart* fascinate fashion* fasten \
  fate father fathom fatigue fatten* fault favor* fawn fax faze \
  fear feast feather feature federalize federate feed* feel* feign feint \
  felicitate fell feminize fence* fend* ferment ferret* ferry fertilize fess* \
  fester festoon fetch fetter feud fiddle fidget field fight* figure* \
  filch file* filibuster fill* fillet film filter finagle finalize finance* \
  find* fine* fine-tune* finesse finger* finish* fire* fireproof firm* fish \
  fissure fit* fix* fixate fizz fizzle flabbergast flag flagellate flail \
  flake* flame flank flap flare* flash* flatten* flatter flaunt flaw \
  flay fleck fledge flee* fleece flesh* flex* flick* flicker flight* \
  flinch fling flip* flip-flop* flirt flit float flock flog flood \
  floor flop floss flounce flounder flour flourish flout flow flower \
  fluctuate flunk fluoresce flush* fluster flutter flux* fly* foal foam \
  focalize focus fog* foil foist fold* foliate follow* foment fondle \
  fool* foot forage forbid force* ford forecast foreclose forego foreknow \
  foresee foreshadow forest forestall foretell forfeit forge forget forgive forgo \
  fork* form formalize formulate forsake fort* fortify forward fossilize foster \
  foul found founder fowl fox foxtrot fraction fracture fragment frame* \
  franchise fray freak* free* freeze* frequent freshen* fret frighten* frisk \
  fritter* frock frog-walk* frolic frost* frost-over* \
  frost-up* froth frown fructify frustrate fry* \
  fuck* fuddle fudge* fuel fulfill fumble fume function fund fundraise* \
  funnel furlough furnish furrow further fuse fuss fuzz gab gabble \
  gag* gain gall gallop galvanize* gamble gambol gape garage garb \
  garble garden garland garner garnish garrotte gas* gash gasify gasp \
  gate gather* gauge gawk gaze gear* gelatinize geminate generalize* generate \
  gentle genuflect germanize germinate gesticulate gesture get* ghost* gibber gibe \
  gift giggle gild gill gird give* give-hand* gladden* glamorize glance glare \
  glass* glaze* gleam glean glide glimmer glimpse glint glisten glitter \
  gloat globalize globetrot glom glorify glory gloss* glove glow glower \
  glue glut glutenize gnash gnaw go* go-to-trouble* goad gobble* goggle golf \
  gondola goof goose-step* gore gorge gossip gouge govern grab grace* \
  grade graduate graffiti graft grandstand grant granulate grapple grasp grass \
  grate gratify gravel gravitate gray graze grease green* greet grieve \
  grill grimace grin grind* grip gripe grit groan grok groom \
  groove grope gross* grouch ground group grouse grovel grow* growl \
  grudge grumble grunt guarantee guard guess guesstimate guffaw guide gull \
  gulp* gum* gun* gurgle gush gust gut gutter guzzle gyrate \
  hack* haggle hail* hallucinate halt halter halve ham* hammer* hamper \
  hamstring hand* hand-count* hand-deliver* hand-paint* handcuff handfeed handicap \
  handing-out* handing-over* handle handout* hands-on* hang* \
  hangar hanker happen* harangue harass harbor hardboil harden* harm* harmonize \
  harness harp harry harshen* harvest hash* hasten hat hatch hate \
  haul* haunt have* \
  have-concession* have-condition* have-frequency* have-hand-in* have-in-hands* have-in-pocket* \
  have-instrument* have-li* have-manner* have-meaning* have-mod* have-mode* have-name* \
  have-on-hand* have-ord* have-ordinality* have-org-role* \
  have-part* have-point* have-polarity* have-purpose* \
  have-quant* have-rel-role* have-subevent* have-trouble* \
  have-value* hawk hay hazard* head* headline headquarter* headquarters* heal \
  heap hear* heartbreak* heartbroken* hearten heat* heave* heckle hedge heed heel* heft \
  heighten* helicopter hellenize help* hem* hemorrhage henna herald herd hesitate \
  hew hew-line* hiccup hide* high-five* highjack* highlight hightail hijack hike hinder \
  hinge hint hire hiss hit* hitch hive hoard hobble hobnob* \
  hock hoe hoist hold* hole* holiday holler hollow* holster home-school* \
  homer hone honeycomb honeymoon honk honor* hoodwink hook* hoot hoover \
  hop hope* hopscotch horrify hose hospitalize host hound house hover \
  howl* huckster huddle hug hulk hull hum* humanize humble humidify* \
  humiliate humor hunch hunger hunker hunt hurl hurry hurt* hurtle \
  hush husk hustle hybridize hydrate hydrogenate \
  hydrolyze hype* hyperbolize hypercontrol hyperlink \
  hypertrophy hyperventilate hypnotize hypothesize* ice identify idle idolize ignite ignore* \
  illuminate illumine illustrate image imagine imbed imbibe imbue imitate immerse \
  immigrate immobilize immolate immunize* impact* impair impale impart impeach impede \
  impel impend imperil impersonate impinge implant implement implicate implore imply \
  import importune impose impound impoverish imprecate impregnate impress* imprint imprison \
  improve improvise impugn in-a-light*n-consequence* in-ones-pocket* in-pocket* \
  inaugurate incandesce incapacitate incarcerate incense incentivize inch \
  incinerate incise incite incline* include incorporate increase incriminate incubate incur \
  indemnify indent index indicate indict indispose indoctrinate induce* induct* indulge \
  indurate industrialize infect infer infest infiltrate inflame inflate inflect inflict \
  influence inform infringe infuriate* infuse ingest ingrain ingratiate inhabit inhale \
  inherit inhibit* initial initiate inject injure ink* inlay innovate inquire \
  inscribe insert insinuate insist inspect inspire inspissate install instigate instill \
  institute* institutionalize* instruct insulate insult insure integrate intend* intensify* interact \
  intercede intercept interchange interconnect interest interfere interject interlace interlard interleave \
  interlink interlope intermarry intermingle intermix internalize* interpolate interpose interpret interrelate \
  interrogate interrupt intersect intersperse intertwine intervene interview interweave intimate intimidate \
  into-hand* intone intoxicate intrigue introduce intrude inundate inure invade invalidate inveigle \
  invent invert invest investigate invigorate invite invoice invoke involve* iodize \
  ionize irk iron* irradiate irrigate irritate* irrupt isolate issue \
  itch itemize iterate jab jabber jack* jade jail jam* jangle \
  japan japanize jar jeep jeer jell jeopardize jerk jest jet* \
  jettison jibe jig jiggle jilt jingle jinx jitterbug jive jockey \
  jog joggle join* joke* jollify jolt jostle jot* journey joust \
  judge jug juggle jumble jump* jump-gun* jump-on-bandwagon* jump-shark* junk junket justify* jut* juxtapose \
  kayak kayo keen keep* kennel key* ki-yi* kick* kid kidnap \
  kill* kindle kiss kitten knead knee kneel knell knife knight \
  knit* knock* knot know* kowtow kvetch label labor* lace lacerate \
  lack lacquer ladder lade ladle lag lam* lamb lambaste lament \
  laminate lampoon lance land landfill landscape lane languish lap lapse \
  lard lash* lasso last* latch* lather laud laugh* launch launch-a-coup* launder \
  lave lavish lay* leach lead* leaf leak lean leap* leapfrog \
  learn lease leash leave* leaven lecture leer legalize* legislate legitimize* \
  lend lengthen* lessen* let* letter level* leverage levitate levy liaise \
  libel liberalize* liberate license lichenify lick* lie* lift ligate light* \
  lighten* lightening* lightening-up* lighting* lighting-up* lightning lignify \
  like* liken* lilt limber* limit limp \
  line* line-draw* line-in-sand* linger link* lint lionize lipstick liquefy* liquidate liquidize liquify* \
  lisp list* listen litigate litter live* load* loaf loan* \
  loathe lob lobby lobotomize localize* locate lock* lodge* loft \
  log* log-roll* loiter loll lollop long* long-jump* longjump* look* lookit* loom loop loose* \
  loosen* loot lop lope lord lose* lounge lour louse* love \
  low* lower* lubricate lug lull lumber lump lunch luncheon lunge \
  lurch lure lurk lust luteinize luxuriate macerate machinate madden* magnetize \
  magnify mail maim mainstream maintain major make* make-fun* make-light* make-point* make-trouble* \
  malign* malinger* malingering* man manacle \
  manage* mandate maneuver mangle manhandle manicure manifest manipulate manoeuvre* mantle \
  manufacture map mar march marginalize* marinate mark* market marry marshal \
  martyr marvel mash mask masquerade mass mass-produce* massacre massage master \
  mastermind masticate match* mate materialize matter maturate* mature* maul maunder \
  maximize mean* meander measure* mechanize meddle mediate medicate meditate meet* \
  meld mellow* melt memorialize memorize menace mend mention mentor meow \
  merchandise merge merit mesh mesmerize mess* message metabolize metamorphose metastasize methylate \
  mew mic* microfilm microwave miff migrate militate milk mill mime \
  mimeograph mimic mince mind* minding* mine mineralize mingle miniaturize minimise* minimize* \
  minister mint mire mirror misapprehend misappropriate misbehave miscalculate mischaracterize misconstrue \
  misdiagnose misdirect misfire misguide mishandle misinterpret misjudge mislay mislead mismanage \
  misplace misquote misread misrepresent miss* mission* misspell \
  misspend misstate mist* mist-over* mist-up* mistake \
  mistime mistreat mistrust misunderstand misuse mitigate mix* mizzle moan mob \
  mobilize* mock model modem moderate* modernize* modify modulate moil moisten* \
  moisturize mold molder molest mollify molt monetize money monitor monkey* \
  monogram monopolize moo moon moonlight moor moot mop mope moped \
  moralize* morph mortgage mortify mosey mother motion motivate motor motorbike \
  motorcycle motorize mottle moult mound mount* mourn mouth move* mow \
  muck* muddle* muddy muffle mulch mulct mull multi-task* multiply mumble \
  mummify munch murder murmur muscle muse mushroom muster mutate mute \
  mutilate mutter muzzle myristoylate* myristoylation* mystify nab nag nail* name* name-drop* namedrop* \
  nap narrate narrow* nasal* nasalize* nationalize natter naturalize* nauseate navigate \
  near neaten* necessitate neck necrotize need* needle negate* neglect negotiate \
  neigh neighbor nest nestle net* netmail nettle network neutralize* never-mind* nevermind* nibble \
  nick nickel nickname niggle nip* nitrify nobble nod* nominate normalize* nose* \
  nose-dive* nosedive* nosh notch note* notice* notify nourish \
  nudge nullify* numb number nurse nurture nut nuzzle oar obey \
  obfuscate object* objectify obligate* oblige obliterate obscure observe obsess obstruct \
  obtain obviate occasion occult occupy occur offend* offer officiate offload \
  offset ogle oil* oink okay* omit on-hand* ooh ooze open* operate* \
  opine oppose oppress opt optimize orbit orchestrate ordain order* organize \
  orient originate ornament orphan oscillate osculate* ossify ostracize oust out* \
  out-of-hand* out-of-hands* out-of-pocket* out-of-touch* \
  outbid outdistance outdo outface outfit outflank outgrow outlast outlaw outline \
  outlive outlying outmatch outnumber outpace outperform outrace outrage* outrank outrun \
  outsell outshine outsmart outsource outstrip outweigh outwit overarch overawe overbake \
  overbid overburden overcast overcharge overcome overcook overdo overdose overdraw overemphasize \
  overestimate overflow overgrow overhang overhaul overhear overheat overindulge overjoy overlap \
  overlay overleap overload overlook overnight overpay overpower overprice overrate overreach \
  overreact override overrule overrun oversee* oversell overshadow oversight* oversimplify overspread \
  overstate overstay overstep overstimulate overstock overstrain overstress overtake overtax overthink* \
  overthrow overturn overuse overvalue overwhelm overwork owe own* oxidize oyster \
  pace* pacify pack* package pad paddle paddywhack padlock page pain \
  paint* pair* palaver pale* pall palm* palpitate pamper pan* pander \
  panel panhandle panic pant paper parachute parade paragraph parallel paralyze \
  paraphrase parboil parcel* parch pardon pare* park parlay parody parole \
  parquet parry part* partake participate partition partner party pass* paste \
  pasteurize pasture pat patch* patent patrol patronize patter pattern pauper \
  pause pave paw pawn pay* pay-mind* peacemake peak peal pearl peck \
  pedal peddle pederastize pee peek peel* peep peer peeve peg \
  pelt pen* penalize pencil pend penetrate people pepper perambulate perceive* \
  perch percolate perfect perforate perform* perfume perish perk* perm permeate \
  permit* perpetrate perpetuate perplex persecute persevere persist personalize* personify perspire \
  persuade* pertain perturb peruse pervade pester pet petition petrify phase* \
  philander philosophize phone phosphoresce phosphorylate photocopy photograph pick* picket pickle pickpocket \
  picnic picture piece pierce pigeonhole piggyback pile* pilfer pillory pilot \
  pin* pinch* pine* ping pinion pink* pinpoint pioneer pip pipe* \
  pique pirate pirouette piss* pit* pitch* pith pity* pivot placate \
  place plagiarize plague plait plan plane plank plant plaster plate \
  play* play-into-hands* play-into-ones-hands* plead please* pledge plink plod plonk plop plot* plough* \
  plow pluck plug* plumb* plummet plump plunder plunge plunk ply* \
  poach pocket* pockmark pod point* point-finger* pointless* pointlessness* \
  poise poison* poke* poke-fun* polarize police \
  polish* politicize polka poll pollinate pollute polymerization* polymerize* pomade ponder pontificate \
  poo pooh-pooh* pool pop* popularize* populate pore port portend portion \
  portray pose posit position possess* post* postage* poster postmark postpone postulate \
  posture pot potter pounce pound* pour pout powder power* practical* practically* practice* practicing* \
  practise* practising* praise prance prattle prawn pray pre-empt* pre-negotiate* pre-separate* pre-set* \
  preach prearrange precautionary* precaution* precautious* precede precipitate \
  preclude predate* predetermine predicate predict predispose \
  predominate preempt* preen prefer* preform prejudice premeditate premiere premise preoccupy \
  prepare prepay prepossess presage prescribe present* preserve preside press* pressure \
  pressurize prestate presume* pretend prevail prevent preview prey price* prick* \
  prickle pride prime primp print* prioritize privatize* privilege prize probe \
  proceed* process proclaim procrastinate procure prod produce* profess proffer profile \
  profit* profiteer program progress* prohibit* project proliferate prolong promenade promise \
  promote prompt* promulgate pronounce* proof* proofread prop* propagandize propagate propel \
  prophesy proportion propose proscribe prosecute proselytize prospect prosper prostitute prostrate \
  protect protest protract protrude prove* provide* provision* provoke prowl prune \
  pry publicize* publish* pucker* puff* puke* pull* pulp pulsate pulse \
  pulverize pummel pump* punch punctuate puncture punish* punt* pup purchase \
  purge purify* purl purloin purple purport purpose purr purse pursue \
  push* put* putrefy putter putty puzzle pyramid quack quadruple quaff \
  quake qualify quantify quantize quarantine quarrel quarry quarter* quash quaver \
  quell quench query quest question* queue* quibble quicken* quickstep quiet* \
  quieten* quip quirk quit quiver quiz quote rabbit race rack* \
  racket radiate radical* radicalization* radicalize* radio raft rafter rag rage raid rail railroad \
  rain raise* rake* rally ram ramble ramify* ramp* ranch range \
  rank rankle ransack ransom* rap rape rarefy* rasp rat ratchet* rate* \
  ratify ration* rattle* ravage rave ravish raze re-case* re-create* \
  re-debate* re-elect* re-emerge* re-emphasize* re-employ* re-enact* re-engage* re-enter* re-evaluate* re-export* \
  re-fight* re-fix* re-landscape* re-ship* re-summon* re-unify* re-victimize* reach* react* reactivate \
  read* read-between-lines* readapt readjust readmit ready reaffirm realign realize* reallocate ream \
  reanimate reap reappear reapply reapportion reappraise rear rearm rearrange reason* \
  reassemble reassert* reassess reassign reassure reawaken rebear rebel rebound rebuff \
  rebuild rebuke rebut recalculate recalibrate recall recant recap recapitulate recapture \
  recast recede* receive recess recharge recirculate recite reckon reclaim reclassify \
  recline recode recognize recoil recollect recombine recommence recommend recommit recompense \
  reconcile reconsider reconstitute reconstruct reconvene record recount recoup recover* recreate* \
  recruit rectify recuperate recur recuse recycle redden* redecorate redeem redefine \
  redeploy redesign redevelop redirect rediscover redistribute redline redo redouble redound \
  redraw redress reduce reek reel* reelect* reenact* reestablish reevaluate* reeve \
  reexamine refashion refer* referee reference* refile refill refinance refine refit \
  reflate reflect refocus reform reformulate refrain refresh refuel refund refurbish \
  refuse refute regain regale regard* regenerate register regress regret regroup \
  regularize* regulate regurgitate rehabilitate rehash rehearse reheat rehire reign reignite \
  reimagine reimburse reimplant reimpose rein* reincarnate reinforce reinscribe reinstall reinstate \
  reinsure reintegrate reintroduce reinvent reinvigorate reiterate reject rejoice rejoin rejuvenate \
  rekindle relapse relate* relax relay release relegate relent relieve relinquish \
  relish relive reload relocate reluctant* rely remain* remake remand remark* remarry \
  remedy remember remind reminisce remit* remodel remonstrate remove remunerate rename \
  rend render* rendezvous renege renegotiate renew renounce renovate rent* reoccur \
  reopen reorganize reorient repackage repaint repair repatriate repay repeal repeat \
  repel repent rephrase replace replant replay replenish replicate reply repopulate \
  report repose reposition repossess repost represent* repress reprimand reprint reproach \
  reprobate reprocess reproduce reprove repudiate repulse repute request* require requisition \
  reread reroute rerun* reschedule rescind rescue research reseat resell resemble \
  resent reserve* reset resettle reshape reshuffle reside resign* resile resist \
  resolve* resonate resort resound respect respire respond* rest restart restate \
  restore restrain restrict restructure resubmit result resume resupply resurface resurge \
  resurrect resuscitate retail retain* retake retaliate retard retch retest rethink \
  reticulate retie retire retool retort retrace retract retrain retreat* retrench \
  retrial retribute* retribution* retrieve retrofit retrograde retrogress retry return* reunite reup reuse \
  rev* revalue revamp reveal revel reverberate revere reverse revert review* \
  revile revise revisit revitalize revive revoke revolt* revolutionize* revolve* reward \
  rework rewrite rhapsodize rhyme rickshaw rid ridden riddle ride* ridicule* \
  riff riffle rifle rift* rifting* rig* right* right-size* rile rim rind ring* \
  rinse riot rip* ripen* ripple rise* risk* rissole rival rive \
  rivet roam roar roast rob robe rock* rocket roil roll* \
  romance* romanticize* romp roof roost root* rope rosin rot rotate \
  rouge rough* roughen* round* rouse roust route* rove row rub \
  rubberize* rue ruffle ruin rule* rumba rumble ruminate rummage rumor \
  rumple run* rupture rush rust rusticate rustle rut sabotage sack \
  sacrifice sadden* saddle safeguard sag sail salaam salivate salt* salute \
  salvage salve samba sample sanctify sanction sand sandpaper sandwich sanitize \
  sap saponify sashay satellite satiate satirize satisfy* saturate sauce saunter \
  saute save* savor savvy saw* say scald scale* scallop scalp \
  scamper scan scandalize scant scapegoat scar scare* scarf scarify scatter \
  scavenge scent* scent-out* schedule scheme schlep schmooze school scintillate sclerose scoff \
  scold scollop scoop* scoot scope scorch score* scorn scotch scour \
  scout* scowl scrabble scram scramble* scrap scrape* scratch* scrawk scrawl* \
  scream screech* screen* screw* scribble scrimp script scriptwrite scroll scrounge \
  scrub* scrunch* scruple scrutinize scud scuff scuffle sculpt sculpture scurry \
  scutter scuttle seal* sear search season seat secede seclude \
  second second-guess* secrete section secularize secure sedate seduce see* seed* seek* \
  seem seep seesaw seethe segment segregate seize* select self-adjust* self-adjustment* self-destruct* \
  self-efface* self-establish* sell* semaphore send* sense* sensitize sentence sentimentalize separate \
  sequester sequin serenade serve* service* set* settle* sever sew* shack* \
  shackle shade shadow shag shake* shamble shame shampoo shanghai shape* \
  share* shark sharpen* shatter shave shawl shear sheathe shed* shed-light* shell* \
  shellac shelter shelve shepherd shield shift shimmer shimmy shine* shingle \
  ship* shipwreck shirk shirr shit shiver shock shoe shoehorn shoo \
  shoot* shop shoplift shore* short* short-circuit* shortage* shortcircuit* shoulder shout* \
  shove shovel show* showcase shower shred shriek shrill shrimp shrink \
  shrivel shroud shrug* shuck shudder shuffle* shun shunt shut* shutter \
  shuttle* shy* sibilate sicken* side sidestep sidetrack sidle sift sigh \
  sight sightsee sign* signal* signify* silence silhouette silicify silkscreen silt* \
  silver simmer simper simplify* simulate sin sing singe single* single-minded* singleminded* sink* \
  sip siphon* sire sit* site situate size* sizzle skate skateboard \
  skedaddle sketch* skew skewer ski skid skim* skimp skin skindive \
  skip* skipper skirmish skirt skitter skulk skyrocket slack* slacken slake \
  slam slander slant slap slash slate slather slaughter slaver slay \
  sled sledge sleep* sleepwalk sleet sleigh slice* slide slim* slime \
  sling slink slip* slipcover slit slither sliver slobber slog slop \
  slope slosh slouch slow* slug* sluice* slumber slump slurp smack* \
  smart* smarten* smash* smatter smear smell smile smirk smite smoke* \
  smolder smooth* smoothen* smother smudge smuggle smut* snack snag snail \
  snake snap* snare snarl snatch* sneak* sneer sneeze snicker sniff* \
  sniffle snigger snip snipe snitch snivel snoop snooze snore snort \
  snow* snowball snub snuff* snuffle* snuggle soak* soap soar sob \
  sober* socialize* sock* sockdologize sod softboil soften* soil sojourn solace \
  solarize solder sole solemnize solicit solidify* solve somersault soothe sop* \
  sorrow sort* soulsearch sound* sour source souse sovietize sow space* \
  span spank spar spare spark sparkle spat spatter spawn speak* \
  spear spearhead specialize* specify* speckle speculate speed* spell* spellbind spend* \
  spew spice spike* spill* spin* spindle spiral spirit spiritualize spit \
  splash* splatter splay splice splint splinter split* splotch splutter spoil \
  sponge sponsor spook spool spoon-feed* spoonfeed* sport spot spotlight spout* \
  sprain sprawl spray spraypaint spread* spread-eagle* spring* spring-to-mind* sprinkle spritz sprout \
  spruce* spur spurn spurt sputter spy squabble squall* squander square* \
  squaredance squash squat squawk squeak squeal squeegee squeeze* squelch squint \
  squirm squirt squish stab stabilize* stable* stack* staff stage stage-a-coup* \
  stagger* stagnate stain stake* stalk stall* stammer stamp* stampede stanch \
  stand* standardize* staple star starch stare* start* startle starve stash* \
  state station stave* stay* steady steal* steam* steamroller steel steep* \
  steepen* steer* stem* stemmer stencil stenose stent step* sterilize* stew \
  stick* stiffen* stifle stigmatize still stimulate sting stink stipple* stipulate \
  stir* stitch stock* stockpile stoke* stomach stomp stone* stonewall stooge \
  stoop stop* stopper store* storm stow straddle strafe straggle straighten* \
  strain* strand strangle strangulate strap* strategize stratify stray streak stream* \
  streamline strengthen* stress* stretch* strew stride stridulate strike* string strip* \
  strive stroke stroll strop structure struggle strut stub stucco stud \
  study* stuff stultify stumble stump stun stunt stupefy stutter style \
  stymie subcontract subdivide subduct* subduction* subdue subject* subjugate sublet sublimate submerge submit \
  subordinate suborn subpoena subscribe subside subsidize subsist substantiate substitute subsume \
  subtitle subtract subvert succeed* succor succumb suck* suckle suction* sue* \
  suffer suffice suffocate suffuse sugar sugarcoat suggest suit* sulfurize sully \
  sulphur sum* summarize summer summon* sunbathe sunburn sunder sup super \
  superimpose supersede supervene supervise supplant supplement supplicate supply support suppose \
  suppress suppurate surf surface surfeit surge surmise surmount surpass surprise \
  surrender surround surveil survey survive suspect suspend* suspicious* suspiciousness* sustain* swab swaddle \
  swag swagger swallow* swamp swap swarm swash swat swathe sway \
  swear* sweat* sweep* sweeten* swell swelter swerve swig swill swim \
  swindle swing* swipe swirl swish switch* swivel swoon swoop* swoosh \
  symbolize sympathize synchronize* syncopate syndicate synthesize systematize taboo tabulate tack* \
  tackle tag* tail tailgate tailor taint taiwanize take* take-the-trouble* talc talk* talking-point* \
  tally* tame tamp* tamper tan tangle* tango tank tantalize tap* \
  tapdance tape* taper* tar target tarmac tarnish tarry task tassel \
  taste tattoo taunt tauten tax* taxi teach team* tear* tease* \
  tee* teem teeter teethe telecast telegraph telephone televise telework telex \
  tell* temper tempt tend tender tense term terminate terrify terrorize* \
  test testify tether thank* thatch thaw* theorize thicken* thieve thin* \
  think* thirst thrash* thread threaten thrill thrive throb throng throttle \
  throw* thrum* thrust thud thumb thumbtack thump thunder thunk thwack \
  thwap thwart tick* ticket tickle tidy* tie* tighten* tile till \
  tilt time* tin tincture ting tinge tingle tinker tinkle tinsel \
  tint tip* tipple tiptoe tire* tisk tithe titillate title titrate titter \
  toast toboggan toddle toe toe-line* tog toggle toil* tolerate toll tomb \
  tone* tool* tool-up* toot tootle top* topple torch torment torpedo torture \
  toss* total* tote* totter* touch* toughen* tour tousle tout \
  tow towel tower toy trace track* trade* trademark traduce traffic trail* \
  train traipse tram trammel tramp trample tranquilize transact transcend transcribe \
  transfer transfix transform transfuse transgress transit* transition translate transmit transmogrify \
  transmute transpire transplant transport transpose trap trash traumatize travel traverse \
  trawl tread treasure treat* treble tree trek tremble trend trespass \
  trick* trickle trigger* trill strip* trip* triple triumph trivialize troll \
  trolley troop trot* trouble* trounce truck trudge trump trumpet truncate \
  truncheon trundle truss trust* try* tuck* tug* tumble tune* tunnel \
  turf turn* tussle tutor twang* tweak tweet tweeze twiddle twig \
  twin twine twinge twinkle twirl twist* twitch twitter twotime type* \
  typify* tyrannize ubiquitinate ulcerate ululate umpire unblock unbolt unbuckle unburden unbutton \
  uncap unchain unclamp unclasp unclip unclothe uncoil uncover underbid undercharge \
  undercut underestimate undergo* underinflate underlay underlie underline undermine underperform underpin \
  underprice underscore undersell understand understate understudy undertake underuse underutilize undervalue \
  underwrite undo undress undulate unearth unfasten unfix unfold unfurl unglue \
  unhinge unhitch unhook uniform unify unionize* unite unlace unlatch unleash \
  unload unlock unmask unnerve unpack unpeg unpin unplug unquote unravel \
  unreel unroll unscrew unseal unseat unsettle unshackle unstaple unstitch \
  unteach unthaw untie unveil unwind unzip up* upbraid update upgrade \
  uphold upholster uplift upload upregulate uproot upset urbanize urge urinate use* \
  usher* usurp utilize* vacate vacation vacillate vacuum valet validate* \
  value* vamp* vamp-up* vandalize vanish vanquish vaporize varnish vary* vaticinate vault \
  vaunt veer vegetate veil vein vend veneer venerate vent ventilate \
  venture verbalize verge verify verse vest vet veto vex vibrate \
  victimize videotape vie view* viewpoint* vilify* vindicate violate visit visualize vitiate \
  vitrify vocalize vociferate voice void* volatilize volley volunteer* vomit* vote* \
  vouch vow voyage vroom vulcanize vulgarize wad waddle wade waffle \
  waft wag wage wager waggle wail wait* waive wake* waken* \
  walk* wall* wallop wallow wallpaper waltz wander wane wangle want \
  war warble ward* warehouse warm* warmonger warn warp warrant wash* \
  waste* watch* water* wave* waver wax* weaken* wean weaponize wear* \
  weary weasel* weather weave wed wedge weed weekend weep weigh* \
  weight welcome weld welter westernize* wet whack* whale whang \
  wharf* wheedle wheel wheeze whelk whelp whiff* while* whimper whine \
  whinny whip* whipsaw whir* whirr* whish whisk whisper whistle \
  whiten* whitewash* whittle* whiz* wholesale whoop* whoosh whore whump wick \
  widen* widow wield wiggle will wilt win* wince wind* wing \
  wink winkle winnow winter wipe* wire wireless wish withdraw wither \
  withhold withstand witness wobble wolf* womanize wonder* woo woof woolgather \
  word work* worm worry* worship wound wow wrack \
  wrangle wrap* wreak wreathe wreck wrench* wrest wrestle* wriggle wring* \
  wrinkle write* writhe wrong* wrought x-ray* yacht yak yammer* yank \
  yap yaw yawn yearn yell yellow* yelp yield* yip yodel \
  yoke yowl zag zap zero* zest zig zigzag zing zip* \
  zipcode zone* zoom \
// END ONTONOTES VERB FRAMES \
";

var list_of_on_frame_adjective_s = " \
// Note: * indicates more than 2 rolesets. \
// BEGIN ONTONOTES ADJECTIVE FRAMES \
  accountable* agreeable* alien allergic answerable* bent* brilliant capable characteristic* \
  clever close* competent confident consistent contrary curious eager earnest efficient* enthusiastic* \
  expert fit* fortunate free* friendly generous good* guilty handy hopeless \
  identical ill indifferent indispensable inferior innocent intelligent* intent* intimate keen \
  kind* lax liable loyal mean* nervous* new notorious \
  obvious opposite partial* patient* peculiar pleasant* polite popular* proficient prone \
  proud* quiet* relevant* responsible* right* righteous* rude safe* same sensitive* \
  serious short* shy* skillful slow* sorry suitable* superior terrible* true* \
  uneasy valid* weak* wrong* zealous \
// END ONTONOTES ADJECTIVE FRAMES \
";

var list_of_on_frame_noun_s = " \
// Note: * indicates more than 2 rolesets. \
// BEGIN ONTONOTES NOUN FRAMES \
  \
// END ONTONOTES NOUN FRAMES \
";

var list_of_concept_to_title_s = " \
        // BEGIN CONCEPT-TO-TITLE \
        3D No such concept. Replace by: (d / dimension :quant 3) \
        CEO No such concept. Replace by: (officer :mod chief :mod executive) \
        I No such concept. Replace by: i (lower case i for the pronoun for first person singular) \
        IED No such concept. Replace by: (device :ARG1-of improvise-01 :ARG1-of (explode-01 :ARG1-of possible-01)) \
        TV No such concept. Replace by: television \
        WMD No such concept. Replace by: (weapon :ARG2-of (destroy-01 :degree mass)) \
        a-ha No such concept. Replace by: aha \
        a-lot No such concept. Replace by: lot \
        academic No such concept. Replace by: academia \
        activity No such concept. Select a sense. \
        advertize-00 No such concept. Replace by: advertise-01 \
        after  :op1 (reference event or time)  :quant (how much after reference event or time)  :duration (duration of time) \
        again-and-again No such concept. Replace by: time-and-again \
        age-quantity No such concept. Replace by: temporal-quantity \
        ago No such concept. Replace by: (b / before :op1 (n / now) :quant (t / temporal-quantity ...)) \
        ah-well No such concept. Replace by: oh-well \
        airstrike No such concept. Replace by: (strike-01 :via air) \
        albeit No such concept. Use :concession \
        alien No such concept. Select a sense. \
        allright No such concept. Replace by: all-right \
        alright No such concept. Replace by: all-right \
        although No such concept. Use :concession \
        amr-annotation-incomplete  No such concept. Annotation of this sentence is incomplete. \
        amr-unintelligible  Even in context and best efforts, meaning can't be determined for part of a sentence. \
        and-so-on No such concept. Replace by: et-cetera \
        annual No such concept. Replace by: (r / rate-entity-91 ...) \
        annually No such concept. Replace by: (r / rate-entity-91 ...) \
        any-longer No such concept. Replace by: no-longer \
        arch-rival No such concept. Replace by: archrival \
        as-well-as No such concept. Replace by: and \
        at-once No such concept. Select a sense: at-once-01 (immediately) or at-once-02 (simultaneously) \
        bacteria No such concept. Replace by: bacterium (singular form) \
        bad No such concept. Select a sense. \
        bd No such concept. Replace by: (disc :mod blu-ray) \
        be-01 No such concept in AMR. Click for help. \
        be-compared-to-91 No such concept. Replace by: have-degree-91 or have-quant-91 \
        before  :op1 (reference event or time)  :quant (how long before reference event or time)  :duration (duration of time)  (ago = before :op1 now :quant temporal-quantity) \
        best No such concept. Replace by: good :ARG2-of have-degree-91 :ARG3 most \
        better No such concept. Replace by: good :ARG2-of have-degree-91 :ARG3 more \
        bi-partisan No such concept. Replace by: bipartisan \
        biannual No such concept. Replace by: (r / rate-entity-91 ...) \
        biannually No such concept. Replace by: (r / rate-entity-91 ...) \
        bimonthly No such concept. Replace by: (r / rate-entity-91 ...) \
        birth-01 No such concept. Replace by: bear-02 \
        biweekly No such concept. Replace by: (r / rate-entity-91 ...) \
        bla-bla No such concept. Replace by: blah-blah-blah \
        bla-bla-bla No such concept. Replace by: blah-blah-blah \
        black No such concept. Select a sense. \
        blackmail No such concept. Select a sense. \
        blah-blah No such concept. Replace by: blah-blah-blah \
        blow-job No such concept. Replace by: blow-03 \
        blowjob No such concept. Replace by: blow-03 \
        burka No such concept. Replace by: burqa \
        burkha No such concept. Replace by: burqa \
        but No such concept. Replace by contrast-01 or :concession \
        by-itself No such concept. Replace by: by-oneself \
        cd No such concept. Replace by: (disc :mod compact) \
        centre No such concept. Replace by: center \
        centrist No such concept. Replace by: center-02 or (person :mod center-02) \
        ceo No such concept. Replace by: (officer :mod chief :mod executive) \
        characteristic No such concept. Select a sense. \
        children No such concept. Replace by child \
        city  Examples: Miami, Berlin, Hong Kong, Washington, D.C. \
        city-region No such concept. Replace by: city-district \
        close No such concept. Select a sense. \
        co-efficient No such concept. Replace by: coefficient \
        colour No such concept. Replace by: color \
        communist No such concept. Replace by: communism or (person :mod communism) \
        consistent No such concept. Select a sense. \
        continent incl. Africa, America, Antarctica, Asia, Australia, Europe  North/Central/South America are world-region. \
        continent-region No such concept. Replace by: world-region \
        continental-region No such concept. Replace by: world-region \
        counter-productive No such concept. Replace by: counterproductive \
        country  Examples: Saudi Arabia, England, European Union,    Kosovo, Palestine, Soviet Union, Taiwan \
        country-region across two or more states/provinces  Examples: Midwest, Holland, Siberia, Transylvania  Regions inside a state are: local-region \
        daily No such concept. Replace by: (r / rate-entity-91 ...) \
        date-entity  :year 1776  :month 7  :day 4  :weekday (t/ thursday)  :time \"16:00\"  :dayperiod (a / afternoon)  :season (s / summer)  :era \"AD\" \
        date-quantity No such concept. Replace by: date-entity \
        demand No such concept. Select a sense. \
        demi-god No such concept. Replace by: demigod \
        despite No such concept. Use :concession \
        distance-entity No such concept. Replace by: distance-quantity \
        dozen No such concept. Replace by: 12 (have a dozen = 6) \
        dummy-element No such concept.  For temporary annotator support only. \
        dvd No such concept. Replace by: (disc :mod digital :mod versatile) \
        e-mail No such concept. Replace by: email \
        earlier No such concept. See AMR Dict for examples. \
        earthquake-00 No such concept. Replace by: earthquake \
        easy No such concept. Select a sense. \
        effective No such concept. Select a sense. \
        email-address-quantity No such concept. Replace by: email-address-entity \
        enthusiastic No such concept. Select a sense. \
        er No such concept. It's probably a speech disfluency that should be dropped from AMR. \
        etc No such concept. Replace by: et-cetera \
        except No such concept. Select a sense. \
        exclamation No such concept.  Drop or consider :mode expressive \
        exclamatory No such concept.  Drop or consider :mode expressive \
        fascist No such concept. Replace by: fascism or (person :mod fascism) \
        feet No such concept. Replace by foot \
        fibre No such concept. Replace by: fiber \
        fight No such concept. Select a sense. \
        figure-head No such concept. Replace by: figurehead \
        financial-quantity No such concept. Replace by: monetary-quantity \
        fit No such concept. Select a sense. \
        flea-bag No such concept. Replace by: fleabag \
        flu No such concept. Replace by: (disease :name (name :op1 \"influenza\")) \
        fly No such concept. Select a sense. \
        foreign-minister No such concept. Decompose. \
        free No such concept. Select a sense. \
        gay No such concept. Replace by: gay-01 or other sense \
        general-secretary No such concept. Replace by: (secretary :mod general) \
        generous No such concept. Select a sense. \
        good No such concept. Select a sense. \
        government No such concept.  Replace by: (government-organization :ARG0-of govern-01) \
        government-entity No such concept.  Replace by: government-organization \
        government-organisation No such concept. Replace by: government-organization (with a \"z\") \
        government-organization executive, legislative, judicial  Excludes military and international organizations (UN) \
        governor-elect No such concept. Decompose. \
        grass-root No such concept. Replace by: grass-roots \
        grassroot No such concept. Replace by: grass-roots \
        grassroots No such concept. Replace by: grass-roots \
        greater-than No such concept. Replace by: more-than \
        grey No such concept. Replace by: gray \
        guilty No such concept. Select a sense. \
        gummint No such concept. Probably a variation of 'government'. \
        happen-01 No such concept. Eliminate \"to take place/happen/occur\" \
        hard-headed No such concept. Replace by: hardheaded \
        headquarter No such concept. Replace by: headquarters-yy (common) or headquarter-01 (rare). \
        her No such concept. Replace by: she \
        herself No such concept. Replace by: she \
        hi-tech No such concept. Replace by: high-technology \
        high-off-the-hog No such concept. Replace by: high-on-the-hog \
        high-tech No such concept. Replace by: high-technology \
        him No such concept. Replace by: he \
        himself No such concept. Replace by: he \
        his No such concept. Replace by: he \
        hoo-haa No such concept. Replace by: hoo-ha \
        hot-link No such concept. Replace by: hotlink \
        hot-spot No such concept. Replace by: hotspot \
        how No such concept. Subsumed by :manner (and other roles), thing and/or amr-unknown \
        however No such concept. Replace by :concession or contrast-01. Click for help. \
        ied No such concept. Replace by: (device :ARG1-of improvise-01 :ARG1-of (explode-01 :ARG1-of possible-01)) \
        if No such concept. Use :condition or :conj-as-if \
        ill No such concept. Select a sense. \
        importance No such concept. Replace by: important-01 \
        important No such concept. Replace by: important-01 \
        in No such concept. Replace by: (a / after :op1 (n / now) :quant (t / temporal-quantity ...)) for cases such as 'in 20 minutes'. \
        inevitable No such concept. Replace by: (possible-01 :polarity - :ARG1 (avoid-01 :ARG1 ...)) \
        influenza No such concept. Replace by: (disease :name (name :op1 \"influenza\")) \
        intelligent No such concept. Select a sense. \
        invisible No such concept. Replace by: visible :polarity - \
        itself No such concept. Replace by: it \
        kill No such concept. Select a sense. \
        kilo No such concept. Replace by: kilogram etc. \
        kilometre No such concept. Replace by: kilometer \
        kind No such concept. Select a sense. \
        kinda No such concept. Replace by: kind-of \
        labour No such concept. Replace by: labor \
        later No such concept. See AMR Dict for examples. \
        launch No such concept. Select a sense. \
        lead No such concept. Select a sense. \
        left-wing No such concept. Replace by: left-19 or (person :ARG1-of left-19) \
        leftist No such concept. Replace by: left-19 or (person :ARG1-of left-19) \
        leftwing No such concept. Replace by: left-19 \
        leftwing-00 No such concept. Replace by: left-19 \
        leftwinger No such concept. Replace by: person :ARG1-of left-19 \
        legal No such concept. Replace by: law \
        length-quantity No such concept. Replace by: distance-quantity \
        less-and-less No such concept. Replace by: decrease-01. See AMR Dict. \
        libtard No such concept. Replace by: (person :ARG1-of liberal-02 :ARG1-of retard-01) \
        licence No such concept. Replace by: license (U.S. spelling for both noun and verb) \
        licit No such concept. Replace by: law \
        lie No such concept. Select a sense. \
        likeable No such concept. Replace by: likable \
        litre No such concept. Replace by: liter \
        lol No such concept. Replace by: :ARG2-of (laugh-01 :ARG0 i :manner loud) \
        low-tech No such concept. Replace by: low-technology \
        math No such concept. Replace by: mathematics \
        maths No such concept. Replace by: mathematics \
        me No such concept. Replace by: i \
        mean No such concept. Select a sense. \
        men No such concept. Replace by man \
        metre No such concept. Replace by: meter \
        micro-organism No such concept. Replace by: microorganism \
        micron No such concept. Replace by: micrometer \
        mid-air No such concept. Replace by: midair \
        military  Examples: Royal Air Force, 101st Airborne Division \
        military-organization No such concept. Replace by: military \
        miss No such concept. Select a sense. \
        monetary-entity No such concept. Replace by: monetary-quantity \
        money-quantity No such concept. Replace by: monetary-quantity \
        monthly No such concept. Replace by: (r / rate-entity-91 ...) \
        more-and-more No such concept. Replace by: increase-01. See AMR Dict. \
        multi-nation No such concept. Replace by: multinational \
        my No such concept. Replace by: i \
        myself No such concept. Replace by: i \
        nazi No such concept. Replace by: nazism or (person :mod nazism) \
        necessary No such concept. Replace by: need-01 \
        neighbour No such concept. Replace by: neighbor \
        neo-conservative No such concept. Replace by: (person :mod neoconservative) or neoconservative \
        neo-nazi No such concept. Replace by: neo-nazism or (person :mod neo-nazism) \
        neocon No such concept. Replace by: (person :mod neoconservative) or neoconservative \
        neoconservatism No such concept. Replace by: neoconservative \
        nervous No such concept. Select a sense. \
        never No such concept. Replace by: :time ever :polarity - \
        nevertheless No such concept. Use :concession \
        new No such concept. Select a sense. \
        news-agency No such concept. Use publication \
        nice No such concept. Select a sense. \
        non-profit No such concept. Replace by: profit-01 :polarity - \
        nonetheless No such concept. Use :concession \
        nonprofit No such concept. Replace by: profit-01 :polarity - \
        not No such concept. Replace by: :polarity - (or in some tricky cases by: have-polarity-91 :ARG2 -) \
        nuclear No such concept. Replace by: nucleus \
        nucleic-acid includes DNA and RNA \
        number-quantity No such concept. Replace by: numerical-quantity \
        obligatory No such concept. Replace by: obligate-01 \
        occur-01 No such concept. Eliminate \"to take place/happen/occur\" \
        off-spring No such concept. Replace by: offspring \
        oh-oh No such concept. Replace by: uh-oh \
        on-line No such concept. Replace by: online \
        on-one-hand No such concept. Replace by: contrast-01 \
        on-other-hand No such concept. Replace by: contrast-01 \
        on-the-one-hand No such concept. Replace by: contrast-01 \
        on-the-other-hand No such concept. Replace by: contrast-01 \
        opinion No such concept. Verbalize using opine-01 \
        or-so No such concept. Replace by: (about :op1 ...) \
        ordinal-entity  :value 2  :range (t / temporal-quantity :quant 16 :unit (y / year))  Example for: \"second\" visit \"in 16 years\" \
        organisation No such concept. Replace by: organization (with a \"z\") \
        organization  includes international organizations (United Nations)  includes NGOs (American Red Cross) \
        otherwise No such concept. See AMR Dict for examples. \
        our No such concept. Replace by: we \
        ourselves No such concept. Replace by: we \
        out-right No such concept. Replace by: outright \
        over-night No such concept. Replace by: overnight \
        pair-wise No such concept. Replace by: pairwise \
        partial No such concept. Select a sense. \
        patient No such concept. Select a sense. \
        people (only in the sense of a racial or national group)  Example: The Kurds are a people without a country.  Example: the peoples of Europe  Otherwise, replace by: person \
        percentage-entity :value 100 \
        percentage-interval No such concept. Replace by: between \
        percentage-quantity No such concept. Replace by: percentage-entity \
        petro-chemical No such concept. Replace by: petrochemical \
        play No such concept. Select a sense. \
        poor-00 No such concept. Replace by: poor \
        possible  :domain ... \
        pre No such concept. Replace by: before \
        pre-empt No such concept. Replace by: preempt-01 or pre-empt-01 \
        pre-emptive No such concept. Replace by: preempt-01 \
        president-elect No such concept. Decompose. \
        prime-minister No such concept. Replace by: minister :mod prime \
        programme No such concept. Replace by: program \
        proliferate No such concept. Select a sense. \
        prostitute No such concept. Select a sense. \
        province  incl. Japanese prefectures  incl. French departments such as Seine Maritime  incl. Chinese autonommous regions such as Tibet \
        publication    incl. new media such as blogs, YouTube videos    incl. news agencies such as Xinhua News Agency  use type 'publication' for publishing companies    if there is at least some sense of publication \
        quarterly No such concept. Replace by: (r / rate-entity-91 ...) \
        quiet No such concept. Select a sense. \
        railway-line  Examples: Trans-Siberian Railway, Picadilly line, Orient Express \
        rain No such concept. Select a sense. \
        ratio-entity No such concept. \
        real No such concept. Replace by: :degree really or :ARG-01 real-04 etc. \
        relative No such concept. Select a sense. \
        relative-location No such concept. Replace by: relative-position \
        relative-position (e.g. 20km east of Rome)  :op1 location  :direction direction  :quant distance-quantity \
        respective No such concept. See AMR Dict for examples. \
        respectively No such concept. See AMR Dict for examples. \
        rich-00 No such concept. Replace by: rich \
        riffraff No such concept. Replace by: riff-raff \
        right No such concept. Select a sense. \
        right-wing No such concept. Replace by: right-08 \
        rightwing No such concept. Replace by: right-08 \
        rightwing-00 No such concept. Replace by: right-08 \
        rightwinger No such concept. Replace by: person :ARG1-of right-08 \
        same No such concept. Select a sense. \
        sci-fi No such concept. Replace by: science-fiction \
        score-quantity No such concept. Replace by: score-entity \
        screw No such concept. Select a sense. \
        secretary-general No such concept. Replace by: (secretary :mod general) \
        seismic-quantity  :quant 7.9  :scale (r / richter) \
        semiannual No such concept. Replace by: (r / rate-entity-91 ...) \
        semiannually No such concept. Replace by: (r / rate-entity-91 ...) \
        serious No such concept. Select a sense. \
        serve No such concept. Select a sense. \
        shoe-in No such concept. Replace by: shoo-in \
        short No such concept. Select a sense. \
        skin-head No such concept. Replace by: skinhead \
        slow No such concept. Select a sense. \
        so-forth No such concept. Replace by: et-cetera \
        so-on No such concept. Replace by: et-cetera \
        socialist No such concept. Replace by: socialism or (person :mod socialism) \
        sorry No such concept. Select a sense. \
        space-craft No such concept. Replace by: spacecraft \
        speaker No such concept. Replace by: (person :ARG0-of speak-01) or speaker-yy (for the position of 'speaker' in parliament etc.) \
        state (in a federal country)  Examples: California, Bavaria \
        state-region No such concept. Replace by: local-region \
        string-entity includes letters, words, phrases, symbols \
        super-power No such concept. Replace by: superpower \
        superior No such concept. Select a sense. \
        take-14 No such concept. Eliminate \"to take place/happen/occur\" \
        temporal-entity No such concept. Replace by: temporal-quantity \
        that-is-it-00 No such concept. For \"That's what it is,\", consider (have-mod-91 :ARG1 it :ARG2 that). \
        the No such concept. Drop articles. \
        their No such concept. Replace by: they \
        them No such concept. Replace by: they \
        themselves No such concept. Replace by: they \
        these No such concept. Replace by: this \
        those No such concept. Replace by: that \
        though No such concept. Use :concession \
        time-and-time-again No such concept. Replace by: time-and-again \
        time-entity No such concept. Replace by: date-entity \
        time-interval No such concept. Replace by: date-interval \
        time-quantity No such concept. Replace by: temporal-quantity \
        tiny-weeny No such concept. Replace by: teeny-weeny \
        to-all-intents-and-purposes No such concept. Replace by: for-all-intents-and-purposes \
        tongue-and-cheek No such concept. Replace by: tongue-in-cheek \
        tonne No such concept. Replace by: ton \
        too  in the sense of 'also', annotate as :mod too  in the sense of 'too much', annotate with have-degree-91 or have-quant-91 \
        true No such concept. Select a sense. \
        truth-value :polarity-of ... \
        tumorigenesis No such concept. Replace by: create-01 :ARG1 tumor \
        tumorigenic No such concept. Replace by: possible-01 :ARG1 (create-01 :ARG1 tumor) \
        tumour No such concept. Replace by: tumor \
        tut-tut-tut No such concept. Replace by: tut-tut \
        tv No such concept. Replace by: television \
        ultra-violet No such concept. Replace by: ultraviolet \
        undersecretary-general No such concept. Replace by: (undersecretary :mod general) \
        unfair No such concept. Replace by: fair :polarity - \
        unique No such concept. Replace by: unique-01 \
        url-entity :value http://www.isi.edu \
        url-quantity No such concept. Replace by: url-entity \
        us No such concept. Replace by: we \
        use No such concept. Select a sense. \
        vice-president No such concept. Replace by: president :mod vice \
        vicepresident No such concept. Replace by: president :mod vice \
        weak No such concept. Select a sense. \
        week-end No such concept. Replace by: weekend \
        weekly No such concept. Replace by: (r / rate-entity-91 ...) \
        weight-quantity No such concept. Replace by: mass-quantity \
        well-being No such concept. Replace by: well-09 \
        what No such concept. Subsumed by :ARGx and/or amr-unknown \
        what-not No such concept. Replace by: et-cetera \
        when No such concept. Subsumed by :time and/or amr-unknown \
        where No such concept. Subsumed by :location and/or amr-unknown \
        which No such concept. Subsumed by :ARGx (and other roles) and/or amr-unknown \
        white No such concept. Select a sense. \
        who No such concept. Subsumed by :ARGx and/or amr-unknown \
        whoop-t-do No such concept. Replace by: whoop-de-do \
        why No such concept. Subsumed by :cause/:purpose and/or amr-unknown \
        wmd No such concept. Replace by: (weapon :ARG2-of (destroy-01 :degree mass)) \
        women No such concept. Replace by woman \
        world-region includes regions across multiple countries.  Examples: Middle East, Balkans, North America \
        worse No such concept. Replace by: bad :ARG2-of have-degree-91 :ARG3 more \
        worst No such concept. Replace by: bad :ARG2-of have-degree-91 :ARG3 most \
        wrong No such concept. Select a sense. \
        y'all No such concept. Replace by: you-all \
        yearly No such concept. Replace by: (r / rate-entity-91 ...) \
        your No such concept. Replace by: you \
        yourself No such concept. Replace by: you \
        // END CONCEPT-TO-TITLE \
";

var list_of_concept_to_url_s = " \
        // BEGIN CONCEPT-TO-URL \
        albeit https://www.isi.edu/~ulf/amr/lib/popup/concession.html \
        although https://www.isi.edu/~ulf/amr/lib/popup/concession.html \
        amr-unintelligible https://www.isi.edu/~ulf/amr/lib/popup/amr-unintelligible.html \
        amr-unknown https://www.isi.edu/~ulf/amr/lib/popup/question.html \
        be-01 https://www.isi.edu/~ulf/amr/lib/popup/be.html \
        but https://www.isi.edu/~ulf/amr/lib/popup/contrast.html \
        date-entity https://www.isi.edu/~ulf/amr/lib/popup/date.html \
        despite https://www.isi.edu/~ulf/amr/lib/popup/concession.html \
        however https://www.isi.edu/~ulf/amr/lib/popup/concession.html#contrast \
        if https://www.isi.edu/~ulf/amr/lib/popup/condition.html \
        interrogative https://www.isi.edu/~ulf/amr/lib/popup/question.html \
        multi-sentence https://www.isi.edu/~ulf/amr/lib/popup/multi-sentence.html \
        nevertheless https://www.isi.edu/~ulf/amr/lib/popup/concession.html \
        nonetheless https://www.isi.edu/~ulf/amr/lib/popup/concession.html \
        though https://www.isi.edu/~ulf/amr/lib/popup/concession.html \
        // END CONCEPT-TO-URL \
";

var list_of_have_rel_role_91_roles = " \
// Note: to distinguish from have-org-role-91 roles. \
// BEGIN HAVE-REL-ROLE-91 ROLES \
  ancestor aunt baby boy boyfriend bro brother brother-in-law buddy \
  child client comrade cousin dad daddy daughter daughter-in-law descendant \
  enemy family father father-in-law friend \
  girl girlfriend godchild goddaughter godfather godmother godparent godson \
  grandchild granddaughter grandfather grandma grandmother grandpa grandparent grandson granny \
  housemate husband in-law kid landlady landlord \
  mate mom mommy mother mother-in-law mum nephew niece parent partner patient peer pop practitioner \
  relative roommate sibling significant-other sis sister sister-in-law son \
  son-in-law spouse stepbrother stepchild stepdaughter stepdaughter stepfather stepmother \
  stepsister stepson tenant therapist uncle wife \
// END HAVE-REL-ROLE-91 ROLES \
";

var list_of_standard_named_entities = " \
// BEGIN STANDARD-NAMED-ENTITIES \
  aircraft aircraft-type airport amino-acid amusement-park animal award \
  bay book bridge broadcast-program building \
  canal canyon car-make cell cell-line city city-district company conference constellation \
  continent country country-region county criminal-organization \
  desert disease dna-sequence earthquake enzyme ethnic-group \
  facility family festival food-dish forest game gene government-organization gulf \
  hotel incident island lake journal language law league local-region location \
  macro-molecular-complex magazine market military \
  molecular-physical-entity moon mountain museum music music-key \
  nationality natural-disaster natural-object newspaper ocean organism organization \
  palace park pathway peninsula person picture planet \
  political-party port protein protein-segment province product publication \
  railway-line regional-group religious-group research-institute river rna road \
  school sea ship show small-molecule spaceship sports-facility star state station strait \
  team territory theater thing treaty tunnel university \
  valley vehicle volcano war work-of-art world-region worship-place zoo \
// END STANDARD-NAMED-ENTITIES \
";