<?php
/**
 * Removes the plugin's saved data when it is deleted from the Plugins screen.
 *
 * @package OrbitCorner_Tools
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// The main plugin file is not loaded during uninstall, so the names are repeated here.
delete_option( 'oc_tools_rates' );
delete_transient( 'oc_tools_rates_draft' );

// The page generator's settings. Pages it created stay: they are your content.
delete_option( 'oc_tools_pages' );
