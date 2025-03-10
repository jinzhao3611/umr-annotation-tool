from umr_annot_tool.resources.rolesets import known_relations
from umr_annot_tool.models import Partialgraph
import logging

def get_merged_rolesets(project_id):
    """
    Merge the default rolesets from rolesets.py with temporary rolesets and relations for a project.
    
    Args:
        project_id: The ID of the project to get temporary rolesets for
        
    Returns:
        dict: Merged dictionary of default and temporary rolesets and relations
    """
    try:
        # Start with all known relations from the default rolesets
        merged_rolesets = known_relations.copy()
        
        # Get temporary rolesets and relations for the project
        partialgraph = Partialgraph.query.filter_by(project_id=project_id).first()
        if not partialgraph or not partialgraph.partial_umr:
            # No temporary rolesets or relations defined for this project
            return merged_rolesets
        
        # Merge temporary rolesets
        if 'temp_rolesets' in partialgraph.partial_umr:
            temp_rolesets = partialgraph.partial_umr['temp_rolesets']
            
            # Merge temporary rolesets with known relations
            # We prioritize temporary rolesets over default ones in case of conflict
            for name, details in temp_rolesets.items():
                # Format the roleset details to match the structure of known_relations
                # Translate 'sub-roles' to 'sub_roles' if needed
                formatted_details = details.copy()
                if 'sub-roles' in formatted_details:
                    formatted_details['sub_roles'] = formatted_details.pop('sub-roles')
                
                # Add the temporary roleset to the merged dictionary
                merged_rolesets[name] = formatted_details
        
        # Merge temporary relations
        if 'temp_relations' in partialgraph.partial_umr:
            temp_relations = partialgraph.partial_umr['temp_relations']
            
            # Merge temporary relations with known relations
            for name, details in temp_relations.items():
                # Add the temporary relation to the merged dictionary
                merged_rolesets[name] = details
        
        return merged_rolesets
    
    except Exception as e:
        logging.error(f"Error merging rolesets: {str(e)}")
        # In case of error, return default rolesets
        return known_relations 